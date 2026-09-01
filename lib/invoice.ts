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

export function amountPaid(payments: { amount: unknown }[]) {
  return payments.reduce((s, p) => s + Number(p.amount), 0);
}
