import type {
  PaymentMethod,
  ViolationCategory,
  ViolationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zonedInstant, zonedParts } from "@/lib/amenity";
import { periodLabel } from "@/lib/format";
import { incomeStatement, balanceSheet, trialBalance } from "@/lib/ledger";
import { buildStatementsForOrg, type Aging } from "@/lib/soa";
import {
  VIOLATION_CATEGORIES,
  VIOLATION_CATEGORY_LABEL,
  VIOLATION_STATUS_BADGE,
  RESOLVED_STATUSES,
} from "@/lib/violation";

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
  openingAR: number;
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
    const openingAR = round2(
      arLines
        .filter((l) => l.entry.entryDate < m.start)
        .reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
    );
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
      openingAR,
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

/* ── late fees report ─────────────────────────────────────────────── */

export type LateFeeRow = {
  propertyId: string;
  unitNumber: string;
  homeownerName: string | null;
  date: Date;
  amount: number;
  relatedInvoice: string;
  occurrenceThisYear: number;
};

/**
 * Late-fee activity for the period. A late-fee invoice is one with
 * `lateFeeParentId` set (the sweep in `lib/late-fees.ts` books it against
 * account 4100). Also returns the top repeat offenders and a trailing-month
 * revenue series for the charts.
 */
export async function lateFeesReport(orgId: string, range: ReportRange) {
  const months = eachMonth(range);
  const yearStart = zonedInstant(zonedParts(range.to).year, 1, 1, 0, 0);
  const since = [range.from, yearStart, months[0]?.start ?? range.from].reduce(
    (a, b) => (a < b ? a : b)
  );

  const fees = await prisma.invoice.findMany({
    where: {
      property: { orgId },
      lateFeeParentId: { not: null },
      status: { not: "VOID" },
      createdAt: { gte: since, lte: range.to },
    },
    select: {
      amount: true,
      createdAt: true,
      property: {
        select: {
          id: true,
          unitNumber: true,
          homeowners: {
            orderBy: { isPrimary: "desc" },
            take: 1,
            select: { fullName: true },
          },
        },
      },
      lateFeeParent: { select: { period: true, memo: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const yearCount = new Map<string, number>();
  for (const f of fees)
    if (f.createdAt >= yearStart)
      yearCount.set(f.property.id, (yearCount.get(f.property.id) ?? 0) + 1);

  const inRange = fees.filter(
    (f) => f.createdAt >= range.from && f.createdAt <= range.to
  );

  const rows: LateFeeRow[] = inRange.map((f) => ({
    propertyId: f.property.id,
    unitNumber: f.property.unitNumber,
    homeownerName: f.property.homeowners[0]?.fullName ?? null,
    date: f.createdAt,
    amount: Number(f.amount),
    relatedInvoice: f.lateFeeParent?.period
      ? periodLabel(f.lateFeeParent.period)
      : f.lateFeeParent?.memo ?? "—",
    occurrenceThisYear: yearCount.get(f.property.id) ?? 0,
  }));

  const periodCount = new Map<string, { unitNumber: string; count: number }>();
  for (const f of inRange) {
    const cur = periodCount.get(f.property.id) ?? {
      unitNumber: f.property.unitNumber,
      count: 0,
    };
    cur.count += 1;
    periodCount.set(f.property.id, cur);
  }
  const repeatOffenders = [...periodCount.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((v) => ({ name: v.unitNumber, value: v.count }));

  const monthly = months.map((m) => ({
    label: m.label,
    value: round2(
      fees
        .filter((f) => f.createdAt >= m.start && f.createdAt <= m.end)
        .reduce((s, f) => s + Number(f.amount), 0)
    ),
  }));

  return {
    from: range.from,
    to: range.to,
    rows,
    repeatOffenders,
    monthly,
    total: round2(rows.reduce((s, r) => s + r.amount, 0)),
    count: rows.length,
  };
}

/* ── vendor spend report ──────────────────────────────────────────── */

export type VendorSpendRow = {
  vendorId: string;
  vendorName: string;
  category: string;
  totalBilled: number;
  totalPaid: number;
  openBalance: number;
};

type BillSpendRow = {
  amount: unknown;
  expenseAccountCode: string;
  vendor: { id: string; name: string };
  payments: { amount: unknown; paidAt: Date }[];
};

/** Pure: roll bills up by vendor (billed / paid-in-period / open balance) and
 *  by expense-account "category". */
export function rollUpVendorSpend(
  bills: BillSpendRow[],
  range: { from: Date; to: Date },
  accountName: Map<string, string>
) {
  const label = (code: string) => accountName.get(code) ?? code;

  const byVendor = new Map<
    string,
    {
      vendorId: string;
      vendorName: string;
      codes: Set<string>;
      totalBilled: number;
      totalPaid: number;
      openBalance: number;
    }
  >();
  const byCategory = new Map<string, number>();

  for (const b of bills) {
    const amt = Number(b.amount);
    const paidInPeriod = b.payments
      .filter((p) => p.paidAt >= range.from && p.paidAt <= range.to)
      .reduce((s, p) => s + Number(p.amount), 0);
    const paidAll = b.payments.reduce((s, p) => s + Number(p.amount), 0);

    const v =
      byVendor.get(b.vendor.id) ??
      {
        vendorId: b.vendor.id,
        vendorName: b.vendor.name,
        codes: new Set<string>(),
        totalBilled: 0,
        totalPaid: 0,
        openBalance: 0,
      };
    v.codes.add(b.expenseAccountCode);
    v.totalBilled += amt;
    v.totalPaid += paidInPeriod;
    v.openBalance += Math.max(0, amt - paidAll);
    byVendor.set(b.vendor.id, v);

    byCategory.set(
      label(b.expenseAccountCode),
      (byCategory.get(label(b.expenseAccountCode)) ?? 0) + amt
    );
  }

  const vendors: VendorSpendRow[] = [...byVendor.values()]
    .map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      category: v.codes.size === 1 ? label([...v.codes][0]) : "Mixed",
      totalBilled: round2(v.totalBilled),
      totalPaid: round2(v.totalPaid),
      openBalance: round2(v.openBalance),
    }))
    .sort((a, b) => b.totalBilled - a.totalBilled);

  const byCategoryArr = [...byCategory.entries()]
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value);

  return {
    vendors,
    byCategory: byCategoryArr,
    topVendors: vendors.slice(0, 10).map((v) => ({
      name: v.vendorName,
      value: v.totalBilled,
    })),
    totalBilled: round2(vendors.reduce((s, v) => s + v.totalBilled, 0)),
    totalPaid: round2(vendors.reduce((s, v) => s + v.totalPaid, 0)),
    openBalance: round2(vendors.reduce((s, v) => s + v.openBalance, 0)),
  };
}

/** Where operating money went, by vendor and by expense category, for a period. */
export async function vendorSpendReport(orgId: string, range: ReportRange) {
  const [bills, accounts] = await Promise.all([
    prisma.bill.findMany({
      where: {
        orgId,
        status: { not: "VOID" },
        billDate: { gte: range.from, lte: range.to },
      },
      select: {
        amount: true,
        expenseAccountCode: true,
        vendor: { select: { id: true, name: true } },
        payments: { select: { amount: true, paidAt: true } },
      },
    }),
    prisma.account.findMany({
      where: { orgId, type: "EXPENSE" },
      select: { code: true, name: true },
    }),
  ]);

  const accountName = new Map(accounts.map((a) => [a.code, a.name]));
  return {
    from: range.from,
    to: range.to,
    ...rollUpVendorSpend(bills, range, accountName),
  };
}

/* ── violations & fines report ────────────────────────────────────── */

export type ViolationRow = {
  violationId: string;
  unitNumber: string;
  homeownerName: string | null;
  category: ViolationCategory;
  categoryLabel: string;
  loggedDate: Date;
  status: ViolationStatus;
  statusLabel: string;
  fineAmount: number;
};

/** Rule-enforcement activity logged in the period. */
export async function violationsReport(orgId: string, range: ReportRange) {
  const violations = await prisma.violation.findMany({
    where: { orgId, createdAt: { gte: range.from, lte: range.to } },
    select: {
      id: true,
      category: true,
      status: true,
      createdAt: true,
      property: {
        select: {
          unitNumber: true,
          homeowners: {
            orderBy: { isPrimary: "desc" },
            take: 1,
            select: { fullName: true },
          },
        },
      },
      fineNotices: { select: { amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: ViolationRow[] = violations.map((v) => ({
    violationId: v.id,
    unitNumber: v.property.unitNumber,
    homeownerName: v.property.homeowners[0]?.fullName ?? null,
    category: v.category,
    categoryLabel: VIOLATION_CATEGORY_LABEL[v.category],
    loggedDate: v.createdAt,
    status: v.status,
    statusLabel: VIOLATION_STATUS_BADGE[v.status].label,
    fineAmount: round2(
      v.fineNotices.reduce((s, f) => s + Number(f.amount), 0)
    ),
  }));

  const byCategory = VIOLATION_CATEGORIES.map((c) => ({
    name: c.label,
    value: rows.filter((r) => r.category === c.value).length,
  }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const resolution = [
    { name: "Open", value: rows.filter((r) => r.status === "OPEN").length },
    { name: "Appealed", value: rows.filter((r) => r.status === "APPEALED").length },
    {
      name: "Resolved",
      value: rows.filter((r) => RESOLVED_STATUSES.includes(r.status)).length,
    },
  ];

  return {
    from: range.from,
    to: range.to,
    rows,
    byCategory,
    resolution,
    count: rows.length,
    openCount: rows.filter(
      (r) => r.status === "OPEN" || r.status === "APPEALED"
    ).length,
    totalFines: round2(rows.reduce((s, r) => s + r.fineAmount, 0)),
  };
}

/* ── homeowners roster ────────────────────────────────────────────── */

export type HomeownerRosterRow = {
  key: string;
  name: string;
  units: string[];
  contactComplete: boolean;
  balance: number;
  status: "current" | "partial" | "overdue";
  portal: "Signed in" | "Never signed in";
};

type RosterHomeowner = {
  fullName: string;
  email: string | null;
  phone: string | null;
  user: { id: string; acceptedAt: Date | null } | null;
  property: { id: string; unitNumber: string };
};
type RosterStatement = {
  propertyId: string;
  closingBalance: number;
  aging: Aging;
};

/**
 * Pure: group primary homeowners into one row per distinct owner (by linked
 * user, else by name), summing balances across their units. `status` — current
 * (no balance) / overdue (any past-due) / partial (owed but not yet due);
 * `portal` — from `User.acceptedAt` (set on first sign-in).
 */
export function rollUpHomeowners(
  homeowners: RosterHomeowner[],
  statements: RosterStatement[]
) {
  const byProperty = new Map(statements.map((s) => [s.propertyId, s]));

  type Group = {
    key: string;
    name: string;
    signedIn: boolean;
    email: boolean;
    phone: boolean;
    props: Map<string, string>;
  };
  const groups = new Map<string, Group>();
  for (const h of homeowners) {
    const key = h.user?.id ?? `name:${h.fullName.trim().toLowerCase()}`;
    const g =
      groups.get(key) ??
      {
        key,
        name: h.fullName,
        signedIn: false,
        email: false,
        phone: false,
        props: new Map<string, string>(),
      };
    if (h.user?.acceptedAt) g.signedIn = true;
    if (h.email) g.email = true;
    if (h.phone) g.phone = true;
    g.props.set(h.property.id, h.property.unitNumber);
    groups.set(key, g);
  }

  const rows: HomeownerRosterRow[] = [...groups.values()]
    .map((g) => {
      let balance = 0;
      let overdue = false;
      for (const propertyId of g.props.keys()) {
        const s = byProperty.get(propertyId);
        if (!s) continue;
        balance += s.closingBalance;
        if (
          s.aging.d1_30 + s.aging.d31_60 + s.aging.d61_90 + s.aging.d90plus >
          0.005
        )
          overdue = true;
      }
      balance = round2(balance);
      return {
        key: g.key,
        name: g.name,
        units: [...g.props.values()].sort(),
        contactComplete: g.email && g.phone,
        balance,
        status: (balance <= 0.005
          ? "current"
          : overdue
          ? "overdue"
          : "partial") as HomeownerRosterRow["status"],
        portal: (g.signedIn ? "Signed in" : "Never signed in") as
          | "Signed in"
          | "Never signed in",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    rows,
    count: rows.length,
    totalBalance: round2(rows.reduce((s, r) => s + r.balance, 0)),
    multiUnit: rows.filter((r) => r.units.length > 1).length,
    byStatus: {
      current: rows.filter((r) => r.status === "current").length,
      partial: rows.filter((r) => r.status === "partial").length,
      overdue: rows.filter((r) => r.status === "overdue").length,
    },
  };
}

/** Homeowner-centric roster as of a date. */
export async function homeownersReport(orgId: string, asOf: Date) {
  const [statements, homeowners] = await Promise.all([
    buildStatementsForOrg(orgId, { from: null, to: asOf }),
    prisma.homeowner.findMany({
      where: { property: { orgId, archivedAt: null }, isPrimary: true },
      select: {
        fullName: true,
        email: true,
        phone: true,
        user: { select: { id: true, acceptedAt: true } },
        property: { select: { id: true, unitNumber: true } },
      },
    }),
  ]);
  return { asOf, ...rollUpHomeowners(homeowners, statements) };
}

/* ── water report ─────────────────────────────────────────────────── */

export type WaterReportRow = {
  propertyId: string;
  unitNumber: string;
  homeownerName: string | null;
  serialNumber: string | null;
  periodConsumption: number | null; // the last month in the range
  rangeConsumption: number;
  rangeBilled: number;
};

/**
 * Water consumption & billing for the period — a per-unit table, a
 * trailing-month series, and (EXTERNAL_BULK) the utility cost vs. what was
 * billed to residents and the system-loss trend.
 */
export async function waterReport(orgId: string, range: ReportRange) {
  const months = eachMonth(range);
  const monthKeys = months.map((m) => m.key);
  const lastKey = monthKeys[monthKeys.length - 1];

  const [org, meters, runs] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { waterSource: true },
    }),
    prisma.waterMeter.findMany({
      where: { orgId, kind: "UNIT", retiredAt: null, property: { isNot: null } },
      select: {
        serialNumber: true,
        property: {
          select: {
            id: true,
            unitNumber: true,
            homeowners: {
              orderBy: { isPrimary: "desc" },
              take: 1,
              select: { fullName: true },
            },
          },
        },
        readings: {
          where: { period: { in: monthKeys } },
          select: { period: true, consumption: true, amount: true },
        },
      },
    }),
    prisma.waterAllocationRun.findMany({
      where: { orgId, period: { in: monthKeys } },
      select: {
        period: true,
        bulkAmount: true,
        systemLoss: true,
        sourceConsumption: true,
      },
    }),
  ]);

  const rows: WaterReportRow[] = meters
    .filter((m) => m.property)
    .map((m) => {
      const p = m.property!;
      const rangeConsumption = round2(
        m.readings.reduce((s, r) => s + Number(r.consumption), 0)
      );
      const rangeBilled = round2(
        m.readings.reduce((s, r) => s + Number(r.amount), 0)
      );
      const last = m.readings.find((r) => r.period === lastKey);
      return {
        propertyId: p.id,
        unitNumber: p.unitNumber,
        homeownerName: p.homeowners[0]?.fullName ?? null,
        serialNumber: m.serialNumber,
        periodConsumption: last ? Number(last.consumption) : null,
        rangeConsumption,
        rangeBilled,
      };
    })
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));

  const runByPeriod = new Map(runs.map((r) => [r.period, r]));
  const monthly = months.map((m) => {
    let consumption = 0;
    let billed = 0;
    for (const meter of meters)
      for (const r of meter.readings)
        if (r.period === m.key) {
          consumption += Number(r.consumption);
          billed += Number(r.amount);
        }
    const run = runByPeriod.get(m.key);
    const src = run ? Number(run.sourceConsumption) : 0;
    return {
      label: m.label,
      consumption: round2(consumption),
      billed: round2(billed),
      bulkCost: run ? Number(run.bulkAmount) : null,
      lossPct: run && src > 0 ? round2((Number(run.systemLoss) / src) * 100) : null,
    };
  });

  const topConsumers = [...rows]
    .filter((r) => r.rangeConsumption > 0)
    .sort((a, b) => b.rangeConsumption - a.rangeConsumption)
    .slice(0, 10)
    .map((r) => ({ name: r.unitNumber, value: r.rangeConsumption }));

  const consumption = round2(rows.reduce((s, r) => s + r.rangeConsumption, 0));
  const billed = round2(rows.reduce((s, r) => s + r.rangeBilled, 0));
  const bulkCost =
    org.waterSource === "EXTERNAL_BULK"
      ? round2(runs.reduce((s, r) => s + Number(r.bulkAmount), 0))
      : null;

  return {
    from: range.from,
    to: range.to,
    mode: org.waterSource,
    rows,
    monthly,
    topConsumers,
    totals: {
      consumption,
      billed,
      bulkCost,
      netPosition: bulkCost == null ? null : round2(billed - bulkCost),
    },
  };
}

/* ── board pack ───────────────────────────────────────────────────── */

export type BoardPackExtra =
  | "late-fees"
  | "vendor-spend"
  | "violations"
  | "homeowners"
  | "water";

export const BOARD_PACK_EXTRAS: { value: BoardPackExtra; label: string }[] = [
  { value: "late-fees", label: "Late fees" },
  { value: "vendor-spend", label: "Vendor spend" },
  { value: "violations", label: "Violations & fines" },
  { value: "homeowners", label: "Homeowners roster" },
  { value: "water", label: "Water" },
];

const EXTRA_SET = new Set<string>(BOARD_PACK_EXTRAS.map((e) => e.value));

/** Normalise a ?extra= search param (repeated or comma-joined) to valid slugs. */
export function parseBoardPackExtras(
  raw: string | string[] | undefined
): BoardPackExtra[] {
  const parts = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((s) =>
    s.split(",")
  );
  return BOARD_PACK_EXTRAS.map((e) => e.value).filter((v) => parts.includes(v));
}

export async function boardPack(
  orgId: string,
  range: ReportRange,
  extras: BoardPackExtra[] = []
) {
  const months = eachMonth(range);
  const want = new Set(extras.filter((e) => EXTRA_SET.has(e)));

  // The DB pooler runs one connection at a time (connection_limit=1). Keep the
  // core reports in the original batch, then fetch the trailing-month chart
  // series in a second pass so a deep fan-out never starves the pool.
  const [org, income, balance, aging, payables, collections, tb, documents] =
    await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { name: true, subdomain: true, waterSource: true },
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

  // Opt-in extra reports — sequential, same pool consideration as the series.
  const lateFees = want.has("late-fees")
    ? await lateFeesReport(orgId, range)
    : null;
  const vendorSpend = want.has("vendor-spend")
    ? await vendorSpendReport(orgId, range)
    : null;
  const violations = want.has("violations")
    ? await violationsReport(orgId, range)
    : null;
  const homeowners = want.has("homeowners")
    ? await homeownersReport(orgId, range.to)
    : null;
  const waterMode = org.waterSource;
  const water =
    want.has("water") &&
    (waterMode === "INTERNAL" || waterMode === "EXTERNAL_BULK")
      ? await waterReport(orgId, range)
      : null;

  return {
    org,
    range,
    extras: [...want],
    income,
    balance,
    aging,
    payables,
    collections,
    trialBalance: tb,
    ledgerSeries,
    cash,
    collectionSeries,
    lateFees,
    vendorSpend,
    violations,
    homeowners,
    water,
    documents,
  };
}
