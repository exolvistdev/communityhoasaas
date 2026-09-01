"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import {
  postInvoiceIssued,
  postInvoiceVoided,
  postPaymentReceived,
} from "@/lib/ledger";

const periodSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Invalid billing period");

/** Properties that would get a new invoice for this period, and the total. */
export async function previewGeneration(period: string) {
  const { org } = await getCurrentOrgContext();
  periodSchema.parse(period);

  const properties = await prisma.property.findMany({
    where: { orgId: org.id, archivedAt: null, invoices: { none: { period } } },
    select: { monthlyRate: true },
  });

  const total = properties.reduce((s, p) => s + Number(p.monthlyRate), 0);
  return { count: properties.length, total };
}

export type GenerateResult =
  | { ok: true; created: number }
  | { ok: false; error: string };

export async function generateMonthlyInvoices(
  period: string
): Promise<GenerateResult> {
  const denied = await denyUnless("billing:write");
  if (denied) return denied;
  const { org } = await getCurrentOrgContext();
  const parsed = periodSchema.safeParse(period);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const [year, month] = period.split("-").map(Number);
  const dueDate = new Date(year, month - 1, org.billingDueDay); // configured due day

  const properties = await prisma.property.findMany({
    where: { orgId: org.id, archivedAt: null, invoices: { none: { period } } },
  });

  let created = 0;
  for (const property of properties) {
    try {
      const invoice = await prisma.invoice.create({
        data: {
          propertyId: property.id,
          amount: property.monthlyRate,
          period,
          dueDate,
          status: "SENT",
          memo: `Monthly dues — ${period}`,
        },
      });
      await postInvoiceIssued(invoice.id);
      created++;
    } catch (e: any) {
      // P2002 = unique violation: another run already billed this property/period
      if (e?.code !== "P2002") throw e;
    }
  }

  revalidatePath("/billing");
  revalidatePath("/dashboard");
  return { ok: true, created };
}

const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.enum(["CASH", "CHECK", "BANK_TRANSFER", "GCASH", "MAYA"]),
  reference: z.string().trim().optional(),
});

export type RecordPaymentResult =
  | { ok: true }
  | { ok: false; error: string };

export async function recordPayment(
  input: unknown
): Promise<RecordPaymentResult> {
  const denied = await denyUnless("billing:write");
  if (denied) return denied;

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const { invoiceId, amount, method, reference } = parsed.data;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, property: { orgId: org.id } },
  });
  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (invoice.status === "VOID")
    return { ok: false, error: "This invoice is void" };

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount,
      method,
      reference: reference || null,
      status: "CONFIRMED",
      confirmedById: user.id,
      confirmedAt: new Date(),
    },
  });
  await postPaymentReceived(payment.id);

  revalidatePath("/billing");
  revalidatePath("/dashboard");
  return { ok: true };
}

const voidSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason").max(500),
});

export type VoidResult = { ok: true } | { ok: false; error: string };

export async function voidInvoice(
  id: string,
  input: unknown
): Promise<VoidResult> {
  const denied = await denyUnless("billing:write");
  if (denied) return denied;

  const parsed = voidSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const invoice = await prisma.invoice.findFirst({
    where: { id, property: { orgId: org.id } },
    include: { payments: true },
  });
  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (invoice.status === "VOID")
    return { ok: false, error: "Already voided" };
  if (invoice.payments.some((p) => p.status === "CONFIRMED"))
    return {
      ok: false,
      error: "This invoice has a confirmed payment — handle the refund first",
    };
  if (invoice.payments.some((p) => p.status === "PENDING"))
    return {
      ok: false,
      error: "Reject the pending payment on this invoice first",
    };

  await postInvoiceVoided(id); // reversing entry — reads invoice.period, still set
  await prisma.invoice.update({
    where: { id },
    data: {
      status: "VOID",
      voidedAt: new Date(),
      voidReason: parsed.data.reason,
      memo: invoice.period ? `Monthly dues — ${invoice.period} (voided)` : invoice.memo,
      period: null, // free the [propertyId, period] slot so the month can regenerate
    },
  });

  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/ledger");
  revalidatePath(`/properties/${invoice.propertyId}`);
  return { ok: true };
}
