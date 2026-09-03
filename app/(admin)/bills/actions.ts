"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { postBillIssued, postBillPayment, postBillVoided } from "@/lib/ledger";
import { BILL_PAYMENT_METHODS } from "@/lib/bill";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/bills");
  revalidatePath("/vendors");
  revalidatePath("/dashboard");
  revalidatePath("/ledger");
  revalidatePath("/reports/payables");
  if (id) revalidatePath(`/bills/${id}`);
}

async function guard() {
  return denyUnless("vendor:manage");
}

const day = (ymd: string) => new Date(`${ymd}T12:00:00+08:00`);

/* ─────────────────────────── record a bill ──────────────────────── */

const billSchema = z.object({
  vendorId: z.string().uuid("Pick a vendor"),
  description: z.string().trim().min(3, "Describe the bill").max(500),
  billNumber: z.string().trim().max(80).optional().or(z.literal("")),
  amount: z.coerce.number().positive("Enter an amount").max(100_000_000),
  billDate: z.string().min(1, "Set the bill date"),
  dueDate: z.string().min(1, "Set the due date"),
  expenseAccountCode: z.string().trim().min(1, "Pick an expense account"),
});

export async function recordBill(input: unknown): Promise<Result<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = billSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const d = parsed.data;

  const [vendor, account] = await Promise.all([
    prisma.vendor.findFirst({ where: { id: d.vendorId, orgId: org.id } }),
    prisma.account.findFirst({
      where: { orgId: org.id, code: d.expenseAccountCode, type: "EXPENSE" },
    }),
  ]);
  if (!vendor) return { ok: false, error: "Vendor not found" };
  if (!account) return { ok: false, error: "That expense account doesn't exist" };

  const billDate = day(d.billDate);
  const dueDate = day(d.dueDate);
  if (Number.isNaN(billDate.getTime()) || Number.isNaN(dueDate.getTime()))
    return { ok: false, error: "Enter valid dates" };

  const bill = await prisma.bill.create({
    data: {
      orgId: org.id,
      vendorId: vendor.id,
      billNumber: d.billNumber || null,
      description: d.description,
      amount: d.amount,
      billDate,
      dueDate,
      status: "UNPAID",
      expenseAccountCode: d.expenseAccountCode,
      createdById: user.id,
    },
  });
  await postBillIssued(bill.id);

  await logAudit({
    action: "bill.record",
    target: vendor.name,
    detail: `₱${d.amount.toLocaleString("en-PH")} · ${d.description}`,
  });
  revalidate(bill.id);
  return { ok: true, id: bill.id };
}

/* ─────────────────────────── pay a bill ─────────────────────────── */

const paySchema = z.object({
  amount: z.coerce.number().positive("Enter an amount"),
  method: z.enum(BILL_PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  paidAt: z.string().min(1, "Set the payment date"),
});

export async function payBill(billId: string, input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = paySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const bill = await prisma.bill.findFirst({
    where: { id: billId, orgId: org.id },
    include: { payments: { select: { amount: true } }, vendor: { select: { name: true } } },
  });
  if (!bill) return { ok: false, error: "Bill not found" };
  if (bill.status === "VOID") return { ok: false, error: "This bill is void" };

  const d = parsed.data;
  const amount = Math.round(d.amount * 100) / 100;
  const paidSoFar = bill.payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.round((Number(bill.amount) - paidSoFar) * 100) / 100;
  if (amount > remaining + 0.005)
    return {
      ok: false,
      error: `Only ₱${remaining.toLocaleString("en-PH")} is left on this bill.`,
    };

  const paidAt = day(d.paidAt);
  if (Number.isNaN(paidAt.getTime()))
    return { ok: false, error: "Enter a valid payment date" };

  const bp = await prisma.billPayment.create({
    data: {
      billId: bill.id,
      amount,
      method: d.method,
      reference: d.reference || null,
      paidAt,
      recordedById: user.id,
    },
  });
  await postBillPayment(bp.id);

  await logAudit({
    action: "bill.pay",
    target: bill.vendor.name,
    detail: `${d.method} ₱${amount.toLocaleString("en-PH")}`,
  });
  revalidate(billId);
  return { ok: true };
}

/* ─────────────────────────── void a bill ────────────────────────── */

const voidSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason").max(500),
});

export async function voidBill(billId: string, input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = voidSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const bill = await prisma.bill.findFirst({
    where: { id: billId, orgId: org.id },
    include: { payments: { select: { id: true } }, vendor: { select: { name: true } } },
  });
  if (!bill) return { ok: false, error: "Bill not found" };
  if (bill.status === "VOID") return { ok: false, error: "Already voided" };
  if (bill.payments.length > 0)
    return {
      ok: false,
      error: "This bill has payments recorded — reverse those before voiding.",
    };

  await postBillVoided(bill.id);
  await prisma.bill.update({
    where: { id: billId },
    data: { status: "VOID", voidedAt: new Date(), voidReason: parsed.data.reason },
  });

  await logAudit({
    action: "bill.void",
    target: bill.vendor.name,
    detail: parsed.data.reason,
  });
  revalidate(billId);
  return { ok: true };
}
