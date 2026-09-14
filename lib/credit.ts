import { prisma } from "@/lib/prisma";
import { postCreditApplied } from "@/lib/ledger";

/**
 * Auto-apply a property's resident credit to a freshly-issued invoice.
 * The decrement is guarded by `creditBalance >= applied` in the WHERE clause
 * so two concurrent billing runs reading the same stale balance can't both
 * apply it and drive the balance negative — the loser sees `count === 0` and
 * skips (the other run already spent that credit).
 *
 * Returns the amount actually applied (0 if none was available, or if a
 * concurrent writer beat this one to it).
 */
export async function applyCreditToInvoice(opts: {
  orgId: string;
  propertyId: string;
  invoiceId: string;
  invoiceAmount: number;
  avail: number;
  appliedById: string;
}): Promise<number> {
  if (opts.avail <= 0.005) return 0;
  const applied = Math.round(Math.min(opts.avail, opts.invoiceAmount) * 100) / 100;

  const { count } = await prisma.property.updateMany({
    where: { id: opts.propertyId, creditBalance: { gte: applied } },
    data: { creditBalance: { decrement: applied } },
  });
  if (count === 0) return 0;

  const ca = await prisma.creditApplication.create({
    data: {
      orgId: opts.orgId,
      propertyId: opts.propertyId,
      invoiceId: opts.invoiceId,
      amount: applied,
      appliedById: opts.appliedById,
    },
  });
  await postCreditApplied(ca.id);
  return applied;
}
