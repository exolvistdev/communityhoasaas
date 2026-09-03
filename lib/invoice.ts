import type { InvoiceStatus } from "@prisma/client";

/** Show OVERDUE for past-due invoices that aren't settled, without needing a
 *  cron job to flip the stored status. */
export function effectiveStatus(inv: {
  status: InvoiceStatus;
  dueDate: Date;
}): InvoiceStatus {
  if (
    inv.status !== "PAID" &&
    inv.status !== "VOID" &&
    inv.dueDate.getTime() < Date.now()
  ) {
    return "OVERDUE";
  }
  return inv.status;
}

/**
 * How much has settled an invoice: payment allocations (the caller should scope
 * the `allocations` query to CONFIRMED payments) plus any resident credit
 * applied to it.
 */
export function invoicePaid(inv: {
  allocations: { amount: unknown }[];
  creditApplications?: { amount: unknown }[];
}) {
  const fromPayments = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
  const fromCredit = (inv.creditApplications ?? []).reduce(
    (s, c) => s + Number(c.amount),
    0
  );
  return fromPayments + fromCredit;
}
