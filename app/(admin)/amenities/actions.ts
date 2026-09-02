"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { postInvoiceIssued, postInvoiceVoided } from "@/lib/ledger";
import { fmtSlot } from "@/lib/amenity";
import {
  notifyBookingDecision,
  notifyBookingCancelled,
} from "@/lib/notify";

type Result = { ok: true } | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/amenities");
  revalidatePath("/amenities/bookings");
  revalidatePath("/portal/amenities");
  if (id) revalidatePath(`/portal/amenities/${id}`);
}

/* ─────────────────────────── amenity CRUD ────────────────────────── */

const amenitySchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  fee: z.coerce.number().min(0).max(1_000_000),
  feeNote: z.string().trim().max(300).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(500),
  openHour: z.coerce.number().int().min(0).max(23),
  closeHour: z.coerce.number().int().min(1).max(24),
  minNoticeHours: z.coerce.number().int().min(0).max(720),
  maxHours: z.coerce.number().int().min(1).max(24),
  cancellationCutoffHours: z.coerce.number().int().min(0).max(720),
  requiresApproval: z.coerce.boolean(),
});

type AmenityData = {
  name: string;
  description: string | null;
  fee: number;
  feeNote: string | null;
  capacity: number;
  openHour: number;
  closeHour: number;
  minNoticeHours: number;
  maxHours: number;
  cancellationCutoffHours: number;
  requiresApproval: boolean;
};

function parseAmenity(
  input: unknown
): { ok: false; error: string } | { ok: true; data: AmenityData } {
  const parsed = amenitySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.closeHour <= d.openHour)
    return { ok: false, error: "Closing hour must be after opening hour." };
  return {
    ok: true,
    data: {
      name: d.name,
      description: d.description || null,
      fee: d.fee,
      feeNote: d.feeNote || null,
      capacity: d.capacity,
      openHour: d.openHour,
      closeHour: d.closeHour,
      minNoticeHours: d.minNoticeHours,
      maxHours: d.maxHours,
      cancellationCutoffHours: d.cancellationCutoffHours,
      // A fee can't be issued as an invoice without a human in the loop.
      requiresApproval: d.fee > 0 ? true : d.requiresApproval,
    },
  };
}

export async function createAmenity(input: unknown): Promise<Result> {
  const denied = await denyUnless("amenity:manage");
  if (denied) return denied;
  const p = parseAmenity(input);
  if (!p.ok) return p;

  const { org } = await getCurrentOrgContext();
  const a = await prisma.amenity.create({ data: { orgId: org.id, ...p.data } });
  await logAudit({ action: "amenity.create", target: a.name });
  revalidate();
  return { ok: true };
}

export async function updateAmenity(
  id: string,
  input: unknown
): Promise<Result> {
  const denied = await denyUnless("amenity:manage");
  if (denied) return denied;
  const p = parseAmenity(input);
  if (!p.ok) return p;

  const { org } = await getCurrentOrgContext();
  const existing = await prisma.amenity.findFirst({
    where: { id, orgId: org.id },
  });
  if (!existing) return { ok: false, error: "Amenity not found" };

  await prisma.amenity.update({ where: { id }, data: p.data });
  await logAudit({ action: "amenity.update", target: p.data.name });
  revalidate();
  return { ok: true };
}

export async function setAmenityArchived(
  id: string,
  archived: boolean
): Promise<Result> {
  const denied = await denyUnless("amenity:manage");
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const existing = await prisma.amenity.findFirst({
    where: { id, orgId: org.id },
  });
  if (!existing) return { ok: false, error: "Amenity not found" };

  await prisma.amenity.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
  await logAudit({
    action: "amenity.archive",
    target: existing.name,
    detail: archived ? "archived" : "restored",
  });
  revalidate();
  return { ok: true };
}

/* ───────────────────────── booking decisions ─────────────────────── */

const noteSchema = z.string().trim().max(500).optional().or(z.literal(""));

async function orgBooking(id: string) {
  const { org } = await getCurrentOrgContext();
  return prisma.amenityBooking.findFirst({
    where: { id, orgId: org.id },
    include: {
      amenity: true,
      invoice: { include: { payments: true } },
      requester: { select: { fullName: true } },
    },
  });
}

export async function decideBooking(
  id: string,
  decision: "CONFIRMED" | "REJECTED",
  note?: unknown
): Promise<Result> {
  const denied = await denyUnless("amenity:manage");
  if (denied) return denied;

  const parsedNote = noteSchema.safeParse(note ?? "");
  if (!parsedNote.success) return { ok: false, error: "Invalid note" };

  const { user } = await getCurrentOrgContext();
  const booking = await orgBooking(id);
  if (!booking) return { ok: false, error: "Booking not found" };
  if (booking.status !== "PENDING")
    return { ok: false, error: "This booking has already been decided" };

  if (decision === "REJECTED") {
    await prisma.amenityBooking.update({
      where: { id },
      data: {
        status: "REJECTED",
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: parsedNote.data || null,
      },
    });
    await logAudit({
      action: "amenity.booking_reject",
      target: `${booking.amenity.name} · ${booking.requester.fullName}`,
      detail: parsedNote.data || undefined,
    });
    await notifyBookingDecision(id).catch(() => {});
    revalidate();
    return { ok: true };
  }

  if (booking.startAt <= new Date())
    return { ok: false, error: "This slot has already passed — reject it instead." };

  // CONFIRMED — re-check the slot against confirmed bookings only, serialized
  // against other confirms + resident bookings for the same amenity.
  const confirmed = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.amenityId}))`;
    const clash = await tx.amenityBooking.count({
      where: {
        amenityId: booking.amenityId,
        status: "CONFIRMED",
        id: { not: id },
        startAt: { lt: booking.endAt },
        endAt: { gt: booking.startAt },
      },
    });
    if (clash >= booking.amenity.capacity) return false;
    await tx.amenityBooking.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        decidedById: user.id,
        decidedAt: new Date(),
        decisionNote: parsedNote.data || null,
      },
    });
    return true;
  });
  if (!confirmed)
    return {
      ok: false,
      error: "That slot is now taken by another confirmed booking.",
    };

  let invoiceId: string | null = null;
  if (Number(booking.amenity.fee) > 0 && booking.propertyId) {
    const invoice = await prisma.invoice.create({
      data: {
        propertyId: booking.propertyId,
        amount: booking.amenity.fee,
        period: null,
        dueDate: booking.startAt,
        status: "SENT",
        memo: `Amenity — ${booking.amenity.name}, ${fmtSlot(booking.startAt, booking.endAt)}`,
      },
    });
    await postInvoiceIssued(invoice.id);
    invoiceId = invoice.id;
    await prisma.amenityBooking.update({
      where: { id },
      data: { invoiceId },
    });
  }

  await logAudit({
    action: "amenity.booking_approve",
    target: `${booking.amenity.name} · ${booking.requester.fullName}`,
    detail: invoiceId
      ? `fee ₱${Number(booking.amenity.fee).toLocaleString("en-PH")}`
      : undefined,
  });
  await notifyBookingDecision(id).catch(() => {});
  revalidate();
  if (invoiceId) {
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    if (booking.propertyId) revalidatePath(`/properties/${booking.propertyId}`);
  }
  return { ok: true };
}

export async function cancelBookingAsStaff(
  id: string,
  note?: unknown
): Promise<Result> {
  const denied = await denyUnless("amenity:manage");
  if (denied) return denied;

  const parsedNote = noteSchema.safeParse(note ?? "");
  if (!parsedNote.success) return { ok: false, error: "Invalid note" };

  const booking = await orgBooking(id);
  if (!booking) return { ok: false, error: "Booking not found" };
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED")
    return { ok: false, error: "This booking can't be cancelled" };

  if (booking.invoice) {
    if (booking.invoice.payments.some((p) => p.status === "CONFIRMED"))
      return {
        ok: false,
        error:
          "This booking's fee has a confirmed payment — handle the refund first.",
      };
    if (booking.invoice.payments.some((p) => p.status === "PENDING"))
      return { ok: false, error: "Reject the pending payment on the fee first." };
    await postInvoiceVoided(booking.invoice.id);
    await prisma.invoice.update({
      where: { id: booking.invoice.id },
      data: {
        status: "VOID",
        voidedAt: new Date(),
        voidReason: "Amenity booking cancelled by staff",
      },
    });
  }

  await prisma.amenityBooking.update({
    where: { id },
    data: {
      status: "CANCELLED",
      decidedById: (await getCurrentOrgContext()).user.id,
      decidedAt: new Date(),
      decisionNote: parsedNote.data || null,
    },
  });

  await logAudit({
    action: "amenity.booking_cancel",
    target: `${booking.amenity.name} · ${booking.requester.fullName}`,
    detail: parsedNote.data || undefined,
  });
  await notifyBookingCancelled(id, "staff").catch(() => {});
  revalidate();
  revalidatePath("/billing");
  revalidatePath("/ledger");
  revalidatePath("/dashboard");
  if (booking.propertyId) revalidatePath(`/properties/${booking.propertyId}`);
  return { ok: true };
}
