// Pure payment-allocation helpers — safe to import from client components.

export type OpenInvoice = {
  id: string;
  /** the invoice's face amount */
  amount: number;
  /** how much is already settled (allocations + credit applied) */
  alreadyPaid: number;
};

export type Allocation = { invoiceId: string; amount: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Spread `amount` across `invoices` in the order given (caller sorts — oldest
 * first). Each invoice takes at most its remaining room; whatever is left over
 * is returned as `credit` (→ resident credit balance).
 */
export function allocateOldestFirst(
  amount: number,
  invoices: OpenInvoice[]
): { allocations: Allocation[]; credit: number } {
  let left = round2(Math.max(amount, 0));
  const allocations: Allocation[] = [];

  for (const inv of invoices) {
    if (left <= 0.005) break;
    const room = round2(inv.amount - inv.alreadyPaid);
    if (room <= 0.005) continue;
    const take = round2(Math.min(left, room));
    allocations.push({ invoiceId: inv.id, amount: take });
    left = round2(left - take);
  }

  return { allocations, credit: round2(Math.max(left, 0)) };
}
