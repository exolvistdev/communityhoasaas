"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { bookingRuleViolations, MAX_UPCOMING_PER_USER } from "@/lib/amenity";
import { postInvoiceIssued } from "@/lib/ledger";
import { notifyBookingRequested, notifyBookingCancelled } from "@/lib/notify";
import { fmtSlot } from "@/lib/amenity";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

class BookingError extends Error {}

function revalidate() {
  revalidatePath("/portal/amenities");
  revalidatePath("/amenities/bookings");
}

const bookSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  purpose: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function bookAmenity(
  amenityId: string,
  input: unknown
): Promise<Result<{ id: string; status: string }>> {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Pick a valid date, start time and length." };

  const { user, org, property } = await getHomeownerContext();
  if (!property)
    return {
      ok: false,
      error: "Your account isn't linked to a unit yet — contact the HOA office.",
    };

  const amenity = await prisma.amenity.findFirst({
    where: { id: amenityId, orgId: org.id, archivedAt: null },
  });
  if (!amenity) return { ok: false, error: "Amenity not found" };

  const { startAt, endAt, purpose } = parsed.data;
  const violations = bookingRuleViolations(amenity, startAt, endAt);
  if (violations.length) return { ok: false, error: violations[0] };

  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      // Serialize concurrent attempts for this amenity.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${amenityId}))`;

      const overlap = await tx.amenityBooking.count({
        where: {
          amenityId,
          status: { in: ["PENDING", "CONFIRMED"] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      });
      if (overlap >= amenity.capacity)
        throw new BookingError("That time is already taken.");

      const upcoming = await tx.amenityBooking.count({
        where: {
          requesterId: user.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          startAt: { gt: new Date() },
        },
      });
      if (upcoming >= MAX_UPCOMING_PER_USER)
        throw new BookingError(
          `You already have ${MAX_UPCOMING_PER_USER} upcoming bookings — cancel one first.`
        );

      return tx.amenityBooking.create({
        data: {
          orgId: org.id,
          amenityId,
          requesterId: user.id,
          propertyId: property.id,
          startAt,
          endAt,
          purpose: purpose || null,
          status: amenity.requiresApproval ? "PENDING" : "CONFIRMED",
        },
      });
    });
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message };
    throw e;
  }

  // Auto-confirmed + has a fee → issue the invoice now.
  if (booking.status === "CONFIRMED" && Number(amenity.fee) > 0) {
    const invoice = await prisma.invoice.create({
      data: {
        propertyId: property.id,
        amount: amenity.fee,
        period: null,
        dueDate: booking.startAt,
        status: "SENT",
        memo: `Amenity — ${amenity.name}, ${fmtSlot(booking.startAt, booking.endAt)}`,
      },
    });
    await postInvoiceIssued(invoice.id);
    await prisma.amenityBooking.update({
      where: { id: booking.id },
      data: { invoiceId: invoice.id },
    });
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    revalidatePath(`/properties/${property.id}`);
  }

  if (booking.status === "PENDING")
    await notifyBookingRequested(booking.id).catch(() => {});

  revalidate();
  return { ok: true, id: booking.id, status: booking.status };
}

export async function cancelBooking(id: string): Promise<Result> {
  const { user } = await getHomeownerContext();

  const booking = await prisma.amenityBooking.findUnique({
    where: { id },
    include: { invoice: { include: { payments: true } } },
  });
  if (!booking || booking.requesterId !== user.id)
    return { ok: false, error: "Booking not found" };
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED")
    return { ok: false, error: "This booking can't be cancelled" };
  if (booking.startAt <= new Date())
    return { ok: false, error: "This booking has already started" };

  if (booking.invoice) {
    if (booking.invoice.payments.length > 0)
      return {
        ok: false,
        error:
          "A fee has been paid on this booking — contact the HOA office to cancel.",
      };
    const { postInvoiceVoided } = await import("@/lib/ledger");
    await postInvoiceVoided(booking.invoice.id);
    await prisma.invoice.update({
      where: { id: booking.invoice.id },
      data: {
        status: "VOID",
        voidedAt: new Date(),
        voidReason: "Amenity booking cancelled by resident",
      },
    });
    revalidatePath("/billing");
    revalidatePath("/ledger");
    if (booking.propertyId) revalidatePath(`/properties/${booking.propertyId}`);
  }

  await prisma.amenityBooking.update({
    where: { id },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });

  await notifyBookingCancelled(id, "requester").catch(() => {});
  revalidate();
  revalidatePath("/dashboard");
  return { ok: true };
}
