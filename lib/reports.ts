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
  const [org, income, balance, aging, collections, tb, documents] =
    await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { name: true, subdomain: true },
      }),
      incomeStatement(orgId, { from: range.from, to: range.to }),
      balanceSheet(orgId, range.to),
      agingSnapshot(orgId, range.to),
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

  return { org, range, income, balance, aging, collections, trialBalance: tb, documents };
}
