"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { postPaymentReceived } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";
import { deliver, recipientSelect } from "@/lib/notifications";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/reconciliation");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  revalidatePath("/properties");
  revalidatePath("/portal");
}

async function findPending(id: string) {
  const { org } = await getCurrentOrgContext();
  return prisma.payment.findFirst({
    where: { id, status: "PENDING", invoice: { property: { orgId: org.id } } },
    include: {
      submittedBy: { select: recipientSelect },
      invoice: { include: { property: { select: { unitNumber: true } } } },
    },
  });
}

const peso = (n: unknown) => `₱${Number(n).toLocaleString("en-PH")}`;

export async function confirmPayment(id: string): Promise<Result> {
  const denied = await denyUnless("billing:write");
  if (denied) return denied;

  const { user } = await getCurrentOrgContext();
  const payment = await findPending(id);
  if (!payment) return { ok: false, error: "Payment not found" };

  await prisma.payment.update({
    where: { id },
    data: { status: "CONFIRMED", confirmedById: user.id, confirmedAt: new Date() },
  });
  await postPaymentReceived(id); // posts the ledger entry + recalculates status

  revalidate();
  await logAudit({
    action: "payment.confirm",
    target: payment.invoice.property.unitNumber,
    detail: `${payment.method} ₱${payment.amount}`,
  });

  if (payment.submittedBy)
    await deliver({
      users: [payment.submittedBy],
      type: "PAYMENT_CONFIRMED",
      title: `Payment confirmed — ${payment.invoice.property.unitNumber}`,
      body: `Your ${peso(payment.amount)} payment was confirmed and applied to your account.`,
      href: "/portal",
    }).catch(() => {});

  return { ok: true };
}

const rejectSchema = z.object({
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function rejectPayment(
  id: string,
  input: unknown
): Promise<Result> {
  const denied = await denyUnless("billing:write");
  if (denied) return denied;

  const parsed = rejectSchema.safeParse(input ?? {});
  const reason = parsed.success ? parsed.data.reason || null : null;

  const payment = await findPending(id);
  if (!payment) return { ok: false, error: "Payment not found" };

  await prisma.payment.update({
    where: { id },
    data: { status: "REJECTED", note: reason },
  });

  revalidate();
  await logAudit({
    action: "payment.reject",
    target: payment.invoice.property.unitNumber,
    detail: reason ?? undefined,
  });

  if (payment.submittedBy)
    await deliver({
      users: [payment.submittedBy],
      type: "PAYMENT_REJECTED",
      title: `Payment needs attention — ${payment.invoice.property.unitNumber}`,
      body: reason
        ? `Your ${peso(payment.amount)} payment could not be confirmed. ${reason}`
        : `Your ${peso(payment.amount)} payment could not be confirmed. Please check the reference and resubmit.`,
      href: "/portal",
    }).catch(() => {});

  return { ok: true };
}
