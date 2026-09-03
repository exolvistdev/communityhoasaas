import type { BillStatus } from "@prisma/client";

// Pure bill helpers — safe to import from client components.

/** Status of a bill from its face amount and how much has been paid. */
export function billStatus(amount: number, paid: number): BillStatus {
  if (paid <= 0.005) return "UNPAID";
  if (paid >= amount - 0.005) return "PAID";
  return "PARTIALLY_PAID";
}

/** Show OVERDUE for an unpaid bill past its due date (not stored). */
export function effectiveBillStatus(bill: {
  status: BillStatus;
  dueDate: Date;
}): BillStatus | "OVERDUE" {
  if (
    (bill.status === "UNPAID" || bill.status === "PARTIALLY_PAID") &&
    bill.dueDate.getTime() < Date.now()
  ) {
    return "OVERDUE";
  }
  return bill.status;
}

export const BILL_STATUS_BADGE: Record<
  BillStatus | "OVERDUE",
  { label: string; className: string }
> = {
  UNPAID: {
    label: "Unpaid",
    className: "bg-warning-subtle text-warning-fg ring-1 ring-inset ring-warning/25",
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-danger-subtle text-danger-fg ring-1 ring-inset ring-danger/25",
  },
  PARTIALLY_PAID: {
    label: "Part-paid",
    className: "bg-brand-subtle text-brand-accent ring-1 ring-inset ring-brand/25",
  },
  PAID: {
    label: "Paid",
    className: "bg-success-subtle text-success-fg ring-1 ring-inset ring-success/25",
  },
  VOID: {
    label: "Void",
    className: "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border",
  },
};

export const BILL_PAYMENT_METHODS = [
  "CASH",
  "CHECK",
  "BANK_TRANSFER",
  "GCASH",
  "MAYA",
] as const;
