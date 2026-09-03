import { prisma } from "@/lib/prisma";
import { periodLabel } from "@/lib/format";
import type { Prisma } from "@prisma/client";

/* ────────────────────────────── types ────────────────────────────── */

export type StatementLine = {
  date: Date;
  kind: "charge" | "payment";
  description: string;
  charge: number;
  payment: number;
  balance: number;
};

export type Aging = {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
};

export type Statement = {
  orgId: string;
  orgName: string;
  propertyId: string;
  unitNumber: string;
  homeownerName: string | null;
  statementDate: Date;
  from: Date | null;
  to: Date;
  openingBalance: number;
  lines: StatementLine[];
  closingBalance: number;
  /** Unapplied resident credit (overpayments carried forward). */
  creditBalance: number;
  /** Refunds paid out in the statement window (informational — they draw down
   *  the credit balance, not the amount due). */
  refunds: { date: Date; amount: number; method: string }[];
  aging: Aging;
};

export type StatementRange = { from: Date | null; to: Date };

/* ──────────────────────────── range parsing ──────────────────────── */

/** Parse ?from / ?to (YYYY-MM-DD) search params into a usable range.
 *  `to` defaults to now; `from` is optional (all-time when absent). */
export function parseStatementRange(sp: {
  from?: string;
  to?: string;
}): StatementRange {
  const parse = (s?: string) => {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const to = parse(sp.to) ?? new Date();
  // include the whole "to" day
  to.setHours(23, 59, 59, 999);
  const from = parse(sp.from);
  if (from) from.setHours(0, 0, 0, 0);
  return { from, to };
}

/* ─────────────────────────── data fetching ───────────────────────── */

const propertyInclude = {
  org: true,
  homeowners: { orderBy: { isPrimary: "desc" } },
  invoices: {
    include: {
      // Only confirmed payments move the balance; pending submissions don't.
      allocations: {
        where: { payment: { status: "CONFIRMED" } },
        include: {
          payment: { select: { method: true, reference: true, paidAt: true } },
        },
      },
      creditApplications: true,
    },
  },
  refunds: { orderBy: { refundedAt: "asc" } },
} satisfies Prisma.PropertyInclude;

export type PropertyWithLedger = Prisma.PropertyGetPayload<{
  include: typeof propertyInclude;
}>;

/* ──────────────────────────── assembly ───────────────────────────── */

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/** Pure statement math for one property's ledger data + a date range.
 *  Exported for unit testing; app code goes through `buildStatement`. */
export function assembleStatement(
  property: PropertyWithLedger,
  { from, to }: StatementRange
): Statement {
  type Txn = Omit<StatementLine, "balance">;
  const txns: Txn[] = [];

  for (const inv of property.invoices) {
    if (inv.status === "VOID") continue;
    // A charge lands on the statement when the invoice is issued, not when it
    // falls due — an issued-but-not-yet-due invoice is still owed. dueDate is
    // only used for aging, below.
    txns.push({
      date: inv.createdAt,
      kind: "charge",
      description: inv.period
        ? `Monthly dues — ${periodLabel(inv.period)}`
        : inv.memo ?? "Dues invoice",
      charge: Number(inv.amount),
      payment: 0,
    });
    for (const a of inv.allocations) {
      txns.push({
        date: a.payment.paidAt,
        kind: "payment",
        description:
          `Payment — ${a.payment.method.replace("_", " ").toLowerCase()}` +
          (a.payment.reference ? ` (ref ${a.payment.reference})` : ""),
        charge: 0,
        payment: Number(a.amount),
      });
    }
    for (const c of inv.creditApplications) {
      txns.push({
        date: c.appliedAt,
        kind: "payment",
        description: "Resident credit applied",
        charge: 0,
        payment: Number(c.amount),
      });
    }
  }

  // charge before payment when they land on the same instant
  txns.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      (a.kind === b.kind ? 0 : a.kind === "charge" ? -1 : 1)
  );

  const openingBalance = txns
    .filter((t) => from && t.date < from)
    .reduce((s, t) => s + t.charge - t.payment, 0);

  let balance = openingBalance;
  const lines: StatementLine[] = [];
  for (const t of txns) {
    if (from && t.date < from) continue;
    if (t.date > to) continue;
    balance += t.charge - t.payment;
    lines.push({ ...t, balance });
  }

  const closingBalance = lines.length ? balance : openingBalance;

  // aging: remaining balance on each unpaid invoice, bucketed by age of its due date
  const aging: Aging = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90plus: 0,
  };
  for (const inv of property.invoices) {
    if (inv.status === "VOID") continue;
    const paid =
      inv.allocations
        .filter((a) => a.payment.paidAt <= to)
        .reduce((s, a) => s + Number(a.amount), 0) +
      inv.creditApplications
        .filter((c) => c.appliedAt <= to)
        .reduce((s, c) => s + Number(c.amount), 0);
    const remaining = Number(inv.amount) - paid;
    if (remaining <= 0.005) continue;
    const age = daysBetween(inv.dueDate, to);
    if (age <= 0) aging.current += remaining;
    else if (age <= 30) aging.d1_30 += remaining;
    else if (age <= 60) aging.d31_60 += remaining;
    else if (age <= 90) aging.d61_90 += remaining;
    else aging.d90plus += remaining;
  }

  return {
    orgId: property.orgId,
    orgName: property.org.name,
    propertyId: property.id,
    unitNumber: property.unitNumber,
    homeownerName: property.homeowners[0]?.fullName ?? null,
    statementDate: new Date(),
    from,
    to,
    openingBalance,
    lines,
    closingBalance,
    creditBalance: Number(property.creditBalance),
    refunds: property.refunds
      .filter((r) => r.refundedAt <= to && (!from || r.refundedAt >= from))
      .map((r) => ({
        date: r.refundedAt,
        amount: Number(r.amount),
        method: r.method,
      })),
    aging,
  };
}

/* ────────────────────────────── public ───────────────────────────── */

/** Statement for one property. Not org-scoped — callers must check
 *  `statement.orgId` against the current tenant. */
export async function buildStatement(
  propertyId: string,
  range: StatementRange
): Promise<Statement | null> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: propertyInclude,
  });
  return property ? assembleStatement(property, range) : null;
}

/** One statement per property in the org, ordered by unit number. */
export async function buildStatementsForOrg(
  orgId: string,
  range: StatementRange & { onlyOutstanding?: boolean }
): Promise<Statement[]> {
  const properties = await prisma.property.findMany({
    where: { orgId },
    include: propertyInclude,
    orderBy: { unitNumber: "asc" },
  });
  const statements = properties.map((p) => assembleStatement(p, range));
  return range.onlyOutstanding
    ? statements.filter((s) => s.closingBalance > 0.005)
    : statements;
}
