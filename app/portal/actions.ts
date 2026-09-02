"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext, ACTIVE_UNIT_COOKIE } from "@/lib/portal";
import { generateGatePassCode } from "@/lib/gatepass";
import { deliver, staffRecipients } from "@/lib/notifications";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

/* ────────────────────────── switch active unit ───────────────────── */

export async function setActiveUnit(propertyId: string): Promise<Result> {
  const { homeowners } = await getHomeownerContext();
  if (!homeowners.some((h) => h.propertyId === propertyId))
    return { ok: false, error: "That unit isn't linked to your account" };

  cookies().set(ACTIVE_UNIT_COOKIE, propertyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/portal", "layout");
  revalidatePath("/account");
  return { ok: true };
}

/* ─────────────────────────── submit payment ──────────────────────── */

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter the amount you paid"),
  method: z.enum(["GCASH", "MAYA"]),
  reference: z.string().trim().min(3, "Enter the reference number"),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function submitPayment(input: unknown): Promise<Result> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user, org, property } = await getHomeownerContext();
  if (!property) return { ok: false, error: "Your account isn't linked to a unit yet" };

  // Apply to the oldest still-open invoice for the unit.
  const invoice = await prisma.invoice.findFirst({
    where: {
      propertyId: property.id,
      status: { notIn: ["PAID", "VOID"] },
    },
    orderBy: { dueDate: "asc" },
  });
  if (!invoice)
    return { ok: false, error: "You have no open invoices right now" };

  const d = parsed.data;
  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: d.amount,
      method: d.method,
      reference: d.reference,
      note: d.note || null,
      status: "PENDING",
      submittedById: user.id,
    },
  });

  revalidatePath("/portal");
  revalidatePath("/reconciliation");
  revalidatePath("/billing");

  const staff = await staffRecipients(org.id, ["ADMIN", "TREASURER"]).catch(
    () => []
  );
  if (staff.length)
    await deliver({
      users: staff,
      type: "PAYMENT_SUBMITTED",
      title: `Payment to reconcile — ${property.unitNumber}`,
      body: `${user.fullName} submitted ₱${d.amount.toLocaleString("en-PH")} (${d.method}, ref ${d.reference}).`,
      href: "/reconciliation",
    }).catch(() => {});

  return { ok: true };
}

/* ────────────────────────── request gate pass ────────────────────── */

const gatePassSchema = z
  .object({
    visitorName: z.string().trim().min(2, "Enter the visitor's name"),
    validFrom: z.coerce.date({ invalid_type_error: "Invalid start time" }),
    validUntil: z.coerce.date({ invalid_type_error: "Invalid end time" }),
  })
  .refine((v) => v.validUntil > v.validFrom, {
    message: "The end time must be after the start time",
    path: ["validUntil"],
  });

export async function requestGatePass(
  input: unknown
): Promise<Result<{ code: string }>> {
  const parsed = gatePassSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user, property } = await getHomeownerContext();
  if (!property) return { ok: false, error: "Your account isn't linked to a unit yet" };

  const d = parsed.data;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGatePassCode();
    try {
      await prisma.gatePass.create({
        data: {
          code,
          propertyId: property.id,
          createdById: user.id,
          visitorName: d.visitorName,
          validFrom: d.validFrom,
          validUntil: d.validUntil,
          status: "ACTIVE",
        },
      });
      revalidatePath("/portal/gate-pass");
      revalidatePath("/gate-passes");
      return { ok: true, code };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        continue;
      throw e;
    }
  }
  return { ok: false, error: "Could not generate a code — try again" };
}
