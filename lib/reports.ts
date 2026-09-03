import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zonedInstant, zonedParts } from "@/lib/amenity";
import { incomeStatement, balanceSheet, trialBalance } from "@/lib/ledger";
import { buildStatementsForOrg, type Aging } from "@/lib/soa";

const pad = (n: number) => String(n).padStart(2, "0");
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type ReportRange = {
  from: Date;
  to: Date;
  fromYmd: string;
  toYmd: string;
};

/**
 * Parse ?from / ?to (YYYY-MM-DD) as Asia/Manila day boundaries.
 * Defaults to 1 January of the current year through today.
 */
export function parseReportRange(sp: { from?: string; to?: string }): ReportRange {
  const now = zonedParts(new Date());
  const fromYmd = YMD.test(sp.from ?? "") ? sp.from! : `${now.year}-01-01`;
  const toYmd = YMD.test(sp.to ?? "")
    ? sp.to!
    : `${now.year}-${pad(now.month)}-${pad(now.day)}`;
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  return {
    fromYmd,
    toYmd,
    from: zonedInstant(fy, fm, fd, 0, 0),
    to: new Date(zonedInstant(ty, tm, td, 23, 59).getTime() + 59_999),
  };
}

/* ── trailing-month series (chart data) ───────────────────────────── */

const round2 = (n: number) => Math.round(n * 100) / 100;

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** month + delta months, as a {year, month(1-12)} pair. */
function shiftMonth(year: number, month1: number, delta: number) {
  const idx = year * 12 + (month1 - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export type MonthBucket = { key: string; label: string; start: Date; end: Date };

/**
 * The trailing 12 months ending at `range.to`, clamped to `range.from` when the
 * report window is shorter (spec: "trailing 12 months, or the period-picker
 * range if shorter"). Month boundaries are Asia/Manila days.
 */
export function eachMonth(range: ReportRange): MonthBucket[] {
  const end = zonedParts(range.to);
  const start = zonedParts(range.from);
  const span = (end.year - start.year) * 12 + (end.month - start.month) + 1;
  const count = Math.max(1, Math.min(12, span));

  const out: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const { year, month } = shiftMonth(end.year, end.month, -i);
    const next = shiftMonth(year, month, 1);
    out.push({
      key: `${year}-${pad(month)}`,
      label: `${MONTHS_SHORT[month - 1]} '${String(year).slice(2)}`,
      start: zonedInstant(year, month, 1, 0, 0),
      end: new Date(zonedInstant(next.year, next.month, 1, 0, 0).getTime() - 1),
    });
  }
  return out;
}

const monthKeyOf = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${pad(p.month)}`;
};

export type ChartRow = { code: string; name: string; amount: number };

export type LedgerMonth = {
  key: string;
  label: string;
  income: number;
  expense: number;
  /** income split by account, for the "income by category" stacked bar */
  dues: number;
  lateFees: number;
  fines: number;
  otherIncome: number;
  /** per-account rows for this month — the "drill into a month" table */
  incomeRows: ChartRow[];
  expenseRows: ChartRow[];
};

type LedgerLineRow = {
  debit: unknown;
  credit: unknown;
  entry: { entryDate: Date };
  account: { type: string; code: string; name: string };
};

const sortByCode = (rows: ChartRow[]) =>
  [...rows].sort((a, b) => a.code.localeCompare(b.code));

/** Pure: fold income/expense journal lines into one row per month. */
export function bucketLedgerByMonth(
  lines: LedgerLineRow[],
  months: MonthBucket[]
): LedgerMonth[] {
  const at = new Map(months.map((m, i) => [m.key, i]));
  type Acc = {
    income: number;
    expense: number;
    dues: number;
    lateFees: number;
    fines: number;
    otherIncome: number;
    incomeByCode: Map<string, ChartRow>;
    expenseByCode: Map<string, ChartRow>;
  };
  const acc: Acc[] = months.map(() => ({
    income: 0,
    expense: 0,
    dues: 0,
    lateFees: 0,
    fines: 0,
    otherIncome: 0,
    incomeByCode: new Map(),
    expenseByCode: new Map(),
  }));

  const bump = (map: Map<string, ChartRow>, a: LedgerLineRow["account"], amt: number) => {
    const row = map.get(a.code) ?? { code: a.code, name: a.name, amount: 0 };
    row.amount += amt;
    map.set(a.code, row);
  };

  for (const l of lines) {
    const i = at.get(monthKeyOf(l.entry.entryDate));
    if (i === undefined) continue;
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    const row = acc[i];
    if (l.account.type === "INCOME") {
      const amt = credit - debit;
      row.income += amt;
      bump(row.incomeByCode, l.account, amt);
      if (l.account.code === "4000") row.dues += amt;
      else if (l.account.code === "4100") row.lateFees += amt;
      else if (l.account.code === "4300") row.fines += amt;
      else row.otherIncome += amt;
    } else if (l.account.type === "EXPENSE") {
      const amt = debit - credit;
      row.expense += amt;
      bump(row.expenseByCode, l.account, amt);
    }
  }

  return months.map((m, i) => {
    const a = acc[i];
    const rows = (map: Map<string, ChartRow>) =>
      sortByCode([...map.values()].map((r) => ({ ...r, amount: round2(r.amount) })));
    return {
      key: m.key,
      label: m.label,
      income: round2(a.income),
      expense: round2(a.expense),
      dues: round2(a.dues),
      lateFees: round2(a.lateFees),
      fines: round2(a.fines),
      otherIncome: round2(a.otherIncome),
      incomeRows: rows(a.incomeByCode),
      expenseRows: rows(a.expenseByCode),
    };
  });
}

/** Monthly income & expense totals (+ per-account split) over a span. */
export async function monthlyLedgerSeries(orgId: string, months: MonthBucket[]) {
  if (months.length === 0) return [] as LedgerMonth[];
  const lines = await prisma.journalLine.findMany({
    where: {
      account: { type: { in: ["INCOME", "EXPENSE"] } },
      entry: {
        orgId,
        entryDate: { gte: months[0].start, lte: months[months.length - 1].end },
      },
    },
    select: {
      debit: true,
      credit: true,
      entry: { select: { entryDate: true } },
      account: { select: { type: true, code: true, name: true } },
    },
  });
  return bucketLedgerByMonth(lines, months);
}

export type CashMonth = { key: string; label: string; cash: number };

/** Month-end balance of Cash (1000) for each month in the span. */
export async function cashTrend(orgId: string, months: MonthBucket[]) {
  if (months.length === 0) return [] as CashMonth[];
  const lines = await prisma.journalLine.findMany({
    where: {
      account: { code: "1000" },
      entry: { orgId, entryDate: { lte: months[months.length - 1].end } },
    },
    select: { debit: true, credit: true, entry: { select: { entryDate: true } } },
  });
  return months.map((m) => ({
    key: m.key,
    label: m.label,
    cash: round2(
      lines
        .filter((l) => l.entry.entryDate <= m.end)
        .reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
    ),
  }));
}

export type CollectionMonth = {
  key: string;
  label: string;
  billed: number;
  collected: number;
  rate: number | null;
};

/** Per-month billed / collected / collection-rate over a span. */
export async function monthlyCollectionSeries(orgId: string, months: MonthBucket[]) {
  if (months.length === 0) return [] as CollectionMonth[];
  const span = {
    gte: months[0].start,
    lte: months[months.length - 1].end,
  };
  const [arLines, invoices, payments] = await Promise.all([
    prisma.journalLine.findMany({
      where: {
        account: { code: "1100" },
        entry: { orgId, entryDate: { lte: months[months.length - 1].end } },
      },
      select: { debit: true, credit: true, entry: { select: { entryDate: true } } },
    }),
    prisma.invoice.findMany({
      where: { property: { orgId }, status: { not: "VOID" }, createdAt: span },
      select: { amount: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: {
        status: "CONFIRMED",
        invoice: { property: { orgId } },
        paidAt: span,
      },
      select: { amount: true, paidAt: true },
    }),
  ]);

  return months.map((m) => {
    const openingAR = arLines
      .filter((l) => l.entry.entryDate < m.start)
      .reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
    const billed = round2(
      invoices
        .filter((i) => i.createdAt >= m.start && i.createdAt <= m.end)
        .reduce((s, i) => s + Number(i.amount), 0)
    );
    const collected = round2(
      payments
        .filter((p) => p.paidAt >= m.start && p.paidAt <= m.end)
        .reduce((s, p) => s + Number(p.amount), 0)
    );
    const expected = openingAR + billed;
    return {
      key: m.key,
      label: m.label,
      billed,
      collected,
      rate: expected > 0.005 ? collected / expected : null,
    };
  });
}

/* ── AR aging / delinquency ───────────────────────────────────────── */

export type AgingUnit = {
  propertyId: string;
  unitNumber: string;
  homeownerName: string | null;
  balance: number;
  aging: Aging;
};

/** Org-wide receivables aging as of a date (units with a balance only). */
export async function agingSnapshot(orgId: string, asOf: Date) {
  const statements = await buildStatementsForOrg(orgId, {
    from: null,
    to: asOf,
    onlyOutstanding: true,
  });

  const totals: Aging = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90plus: 0,
  };
  let outstanding = 0;

  const units: AgingUnit[] = statements
    .map((s) => {
      (Object.keys(totals) as (keyof Aging)[]).forEach(
        (k) => (totals[k] += s.aging[k])
      );
      outstanding += s.closingBalance;
      return {
        propertyId: s.propertyId,
        unitNumber: s.unitNumber,
        homeownerName: s.homeownerName,
        balance: s.closingBalance,
        aging: s.aging,
      };
    })
    .sort((a, b) => b.balance - a.balance);

  return { asOf, units, totals, outstanding, count: units.length };
}

/* ── accounts-payable aging ───────────────────────────────────────── */

export type PayablesVendor = {
  vendorId: string;
  vendorName: string;
  outstanding: number;
  aging: Aging;
};

const emptyAging = (): Aging => ({
  current: 0,
  d1_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90plus: 0,
});

/** Bucket a bill's remaining balance by how far past due it is (current = not
 *  yet due). Mirrors the AR aging buckets. */
function agingBucket(dueDate: Date, asOf: Date): keyof Aging {
  const age = Math.floor((asOf.getTime() - dueDate.getTime()) / 86_400_000);
  if (age <= 0) return "current";
  if (age <= 30) return "d1_30";
  if (age <= 60) return "d31_60";
  if (age <= 90) return "d61_90";
  return "d90plus";
}

/** Org-wide unpaid bills, aged by due date and grouped by vendor, as of a date. */
export async function payablesAging(orgId: string, asOf: Date) {
  const bills = await prisma.bill.findMany({
    where: {
      orgId,
      status: { not: "VOID" },
      billDate: { lte: asOf },
    },
    select: {
      amount: true,
      dueDate: true,
      vendor: { select: { id: true, name: true } },
      payments: {
        where: { paidAt: { lte: asOf } },
        select: { amount: true },
      },
    },
  });

  const byVendor = new Map<string, PayablesVendor>();
  const totals = emptyAging();
  let outstanding = 0;

  for (const b of bills) {
    const paid = b.payments.reduce((s, p) => s + Number(p.amount), 0);
    const remaining = Math.round((Number(b.amount) - paid) * 100) / 100;
    if (remaining <= 0.005) continue;

    const bucket = agingBucket(b.dueDate, asOf);
    const row =
      byVendor.get(b.vendor.id) ??
      {
        vendorId: b.vendor.id,
        vendorName: b.vendor.name,
        outstanding: 0,
        aging: emptyAging(),
      };
    row.outstanding += remaining;
    row.aging[bucket] += remaining;
    byVendor.set(b.vendor.id, row);

    totals[bucket] += remaining;
    outstanding += remaining;
  }

  const vendors = [...byVendor.values()].sort(
    (a, b) => b.outstanding - a.outstanding
  );

  return { asOf, vendors, totals, outstanding, count: vendors.length };
}

/* ── collections summary ──────────────────────────────────────────── */

async function arBalanceAsOf(orgId: string, asOf: Date) {
  const lines = await prisma.journalLine.findMany({
    where: {
      account: { code: "1100" },
      entry: { orgId, entryDate: { lte: asOf } },
    },
    select: { debit: true, credit: true },
  });
  return lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
}

export async function collectionsSummary(
  orgId: string,
  range: { from: Date; to: Date }
) {
  const dayBefore = new Date(range.from.getTime() - 1);

  const [openingAR, closingAR, invoices, payments] = await Promise.all([
    arBalanceAsOf(orgId, dayBefore),
    arBalanceAsOf(orgId, range.to),
    prisma.invoice.findMany({
      where: {
        property: { orgId },
        status: { not: "VOID" },
        createdAt: { gte: range.from, lte: range.to },
      },
      select: { amount: true, period: true, lateFeeParentId: true },
    }),
    prisma.payment.findMany({
      where: {
        status: "CONFIRMED",
        invoice: { property: { orgId } },
        paidAt: { gte: range.from, lte: range.to },
      },
      select: { amount: true, method: true },
    }),
  ]);

  const sum = (xs: { amount: unknown }[]) =>
    xs.reduce((s, x) => s + Number(x.amount), 0);

  const duesBilled = sum(
    invoices.filter((i) => i.period && !i.lateFeeParentId)
  );
  const lateFeesBilled = sum(invoices.filter((i) => i.lateFeeParentId));
  const billed = sum(invoices);
  const otherBilled = billed - duesBilled - lateFeesBilled;
  const collected = sum(payments);

  const byMethod = new Map<PaymentMethod, { count: number; amount: number }>();
  for (const p of payments) {
    const cur = byMethod.get(p.method) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += Number(p.amount);
    byMethod.set(p.method, cur);
  }

  const expected = openingAR + billed;

  return {
    from: range.from,
    to: range.to,
    openingAR,
    closingAR,
    billed,
    duesBilled,
    lateFeesBilled,
    otherBilled,
    collected,
    collectionRate: expected > 0.005 ? collected / expected : null,
    byMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })),
  };
}

/* ── board pack ───────────────────────────────────────────────────── */

export async function boardPack(orgId: string, range: ReportRange) {
  const months = eachMonth(range);

  // The DB pooler runs one connection at a time (connection_limit=1). Keep the
  // core reports in the original batch, then fetch the trailing-month chart
  // series in a second pass so a deep fan-out never starves the pool.
  const [org, income, balance, aging, payables, collections, tb, documents] =
    await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { name: true, subdomain: true },
      }),
      incomeStatement(orgId, { from: range.from, to: range.to }),
      balanceSheet(orgId, range.to),
      agingSnapshot(orgId, range.to),
      payablesAging(orgId, range.to),
      collectionsSummary(orgId, range),
      trialBalance(orgId, { to: range.to }),
      prisma.document.findMany({
        where: {
          orgId,
          category: { in: ["FINANCIAL_STATEMENT", "BOARD_MINUTES"] },
          createdAt: { gte: range.from, lte: range.to },
        },
        select: { id: true, title: true, category: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const ledgerSeries = await monthlyLedgerSeries(orgId, months);
  const cash = await cashTrend(orgId, months);
  const collectionSeries = await monthlyCollectionSeries(orgId, months);

  return {
    org,
    range,
    income,
    balance,
    aging,
    payables,
    collections,
    trialBalance: tb,
    ledgerSeries,
    cash,
    collectionSeries,
    documents,
  };
}
