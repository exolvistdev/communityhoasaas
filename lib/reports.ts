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

  return {
    org,
    range,
    income,
    balance,
    aging,
    payables,
    collections,
    trialBalance: tb,
    documents,
  };
}
