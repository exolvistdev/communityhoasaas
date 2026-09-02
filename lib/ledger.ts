import type { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Standard chart of accounts every org gets on creation. The migration
 * `20260902070000_accounting_foundation` backfills the same set for orgs that
 * were created before it, so this list and that migration must stay in sync.
 */
export const SEED_ACCOUNTS = [
  { code: "1000", name: "Cash", type: "ASSET" as const },
  { code: "1100", name: "Accounts Receivable — Dues", type: "ASSET" as const },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" as const },
  { code: "3000", name: "Fund Balance", type: "EQUITY" as const },
  { code: "3900", name: "Opening Balance Equity", type: "EQUITY" as const },
  { code: "4000", name: "HOA Dues Income", type: "INCOME" as const },
  { code: "4100", name: "Late Fee Income", type: "INCOME" as const },
  { code: "4200", name: "Other Income", type: "INCOME" as const },
  { code: "5000", name: "Operating Expenses", type: "EXPENSE" as const },
  { code: "5100", name: "Utilities", type: "EXPENSE" as const },
  { code: "5200", name: "Repairs & Maintenance", type: "EXPENSE" as const },
  { code: "5300", name: "Security", type: "EXPENSE" as const },
  { code: "5400", name: "Admin & Office", type: "EXPENSE" as const },
  { code: "5900", name: "Other Expense", type: "EXPENSE" as const },
  { code: "6000", name: "Bad Debt Expense", type: "EXPENSE" as const },
];

/**
 * Every money-moving action in the app should go through one of these
 * functions rather than writing JournalEntry/JournalLine rows by hand.
 * That keeps "debits always equal credits" guaranteed in one place.
 */

export async function postInvoiceIssued(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { property: true },
  });

  const [ar, income] = await Promise.all([
    getAccount(invoice.property.orgId, "1100"),
    getAccount(invoice.property.orgId, "4000"),
  ]);

  return prisma.journalEntry.create({
    data: {
      orgId: invoice.property.orgId,
      sourceType: "invoice",
      invoiceId: invoice.id,
      entryDate: invoice.createdAt,
      memo:
        invoice.memo ?? `Dues invoice — unit ${invoice.property.unitNumber}`,
      lines: {
        create: [
          { accountId: ar.id, debit: invoice.amount, credit: 0 },
          { accountId: income.id, debit: 0, credit: invoice.amount },
        ],
      },
    },
    include: { lines: true },
  });
}

/**
 * Reverse the original "invoice issued" entry when an invoice is voided.
 * The original entry is left intact for audit; a fresh entry with the
 * debits/credits swapped brings the ledger back to where it was.
 */
export async function postInvoiceVoided(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { property: true, journalEntry: { include: { lines: true } } },
  });
  if (!invoice.journalEntry) return null; // nothing was posted

  return prisma.journalEntry.create({
    data: {
      orgId: invoice.property.orgId,
      sourceType: "invoice_void",
      entryDate: new Date(),
      // invoiceId stays null — JournalEntry.invoiceId is @unique and the
      // original entry already holds it.
      memo: `Void — dues invoice unit ${invoice.property.unitNumber}${
        invoice.period ? ` (${invoice.period})` : ""
      }`,
      lines: {
        create: invoice.journalEntry.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.credit,
          credit: l.debit,
        })),
      },
    },
    include: { lines: true },
  });
}

export async function postPaymentReceived(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { invoice: { include: { property: true } } },
  });

  const [cash, ar] = await Promise.all([
    getAccount(payment.invoice.property.orgId, "1000"),
    getAccount(payment.invoice.property.orgId, "1100"),
  ]);

  const entry = await prisma.journalEntry.create({
    data: {
      orgId: payment.invoice.property.orgId,
      sourceType: "payment",
      paymentId: payment.id,
      entryDate: payment.paidAt,
      memo: `Payment via ${payment.method} — unit ${payment.invoice.property.unitNumber}`,
      lines: {
        create: [
          { accountId: cash.id, debit: payment.amount, credit: 0 },
          { accountId: ar.id, debit: 0, credit: payment.amount },
        ],
      },
    },
    include: { lines: true },
  });

  await recalculateInvoiceStatus(payment.invoiceId);
  return entry;
}

export type ManualLine = { code: string; debit: number; credit: number };

/**
 * Post a hand-written journal entry (staff "Record entry" form, opening
 * balances, corrections). Throws unless the lines balance to within a cent.
 */
export async function postManualEntry(input: {
  orgId: string;
  entryDate: Date;
  memo: string;
  createdById?: string | null;
  reversalOfId?: string | null;
  lines: ManualLine[];
}) {
  const lines = input.lines
    .map((l) => ({
      code: l.code.trim(),
      debit: Math.round(Number(l.debit) * 100) / 100 || 0,
      credit: Math.round(Number(l.credit) * 100) / 100 || 0,
    }))
    .filter((l) => l.debit > 0 || l.credit > 0);

  if (lines.length < 2)
    throw new Error("A journal entry needs at least two lines.");
  if (lines.some((l) => l.debit > 0 && l.credit > 0))
    throw new Error("Each line is either a debit or a credit, not both.");

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.005)
    throw new Error(
      `Debits (${totalDebit.toFixed(2)}) and credits (${totalCredit.toFixed(
        2
      )}) must be equal.`
    );

  const accounts = await prisma.account.findMany({
    where: { orgId: input.orgId, code: { in: lines.map((l) => l.code) } },
  });
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  for (const l of lines)
    if (!byCode.has(l.code)) throw new Error(`Unknown account "${l.code}".`);

  return prisma.journalEntry.create({
    data: {
      orgId: input.orgId,
      sourceType: "manual",
      entryDate: input.entryDate,
      memo: input.memo,
      createdById: input.createdById ?? null,
      reversalOfId: input.reversalOfId ?? null,
      lines: {
        create: lines.map((l) => ({
          accountId: byCode.get(l.code)!.id,
          debit: l.debit,
          credit: l.credit,
        })),
      },
    },
    include: { lines: true },
  });
}

async function recalculateInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: { where: { status: "CONFIRMED" } } },
  });

  const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const status =
    paid >= Number(invoice.amount)
      ? "PAID"
      : paid > 0
      ? "PARTIALLY_PAID"
      : invoice.status;

  await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
}

async function getAccount(orgId: string, code: string) {
  return prisma.account.findUniqueOrThrow({
    where: { orgId_code: { orgId, code } },
  });
}

/* ─────────────────────────── reporting ───────────────────────────── */

export type LedgerRange = { from?: Date | null; to?: Date | null };

function entryDateFilter(range?: LedgerRange) {
  if (!range || (!range.from && !range.to)) return undefined;
  return {
    entry: {
      entryDate: {
        ...(range.from ? { gte: range.from } : {}),
        ...(range.to ? { lte: range.to } : {}),
      },
    },
  };
}

/**
 * Net balance of the Accounts Receivable — Dues account (code 1100) for an org,
 * straight from the ledger (debits − credits). Should always equal the sum of
 * every property's (invoiced − paid).
 */
export async function arLedgerBalance(orgId: string) {
  const lines = await prisma.journalLine.findMany({
    where: { entry: { orgId }, account: { code: "1100" } },
  });
  return lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
}

/** Sanity check: every entry must net to zero. */
export async function assertLedgerBalances(orgId: string) {
  const lines = await prisma.journalLine.findMany({
    where: { entry: { orgId } },
  });
  const debits = lines.reduce((s, l) => s + Number(l.debit), 0);
  const credits = lines.reduce((s, l) => s + Number(l.credit), 0);
  if (Math.abs(debits - credits) > 0.001) {
    throw new Error(
      `Ledger out of balance for org ${orgId}: debits=${debits} credits=${credits}`
    );
  }
  return { debits, credits, balanced: true };
}

/** Natural balance side of each account type. */
const DEBIT_NORMAL: Record<AccountType, boolean> = {
  ASSET: true,
  EXPENSE: true,
  LIABILITY: false,
  EQUITY: false,
  INCOME: false,
};

export type TrialBalanceRow = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  /** signed so it reads on the account's natural side (>= 0 in practice) */
  balance: number;
};

/**
 * Per-account debit/credit totals. Pass a range to scope by `entryDate`
 * (omit for the whole history).
 */
export async function trialBalance(orgId: string, range?: LedgerRange) {
  const where = entryDateFilter(range);
  const accounts = await prisma.account.findMany({
    where: { orgId },
    include: {
      journalLines: where
        ? { where, select: { debit: true, credit: true } }
        : { select: { debit: true, credit: true } },
    },
    orderBy: { code: "asc" },
  });

  const rows: TrialBalanceRow[] = accounts.map((a) => {
    const debit = a.journalLines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = a.journalLines.reduce((s, l) => s + Number(l.credit), 0);
    const net = debit - credit;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      debit,
      credit,
      balance: DEBIT_NORMAL[a.type] ? net : -net,
    };
  });

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.005,
  };
}

export type ReportRow = { code: string; name: string; amount: number };

/** Income statement (P&L) for a period. */
export async function incomeStatement(
  orgId: string,
  range: { from: Date | null; to: Date }
) {
  const where = entryDateFilter(range);
  const accounts = await prisma.account.findMany({
    where: { orgId, type: { in: ["INCOME", "EXPENSE"] } },
    include: { journalLines: { where, select: { debit: true, credit: true } } },
    orderBy: { code: "asc" },
  });

  const rowFor = (a: (typeof accounts)[number]): ReportRow => {
    const debit = a.journalLines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = a.journalLines.reduce((s, l) => s + Number(l.credit), 0);
    const amount = a.type === "INCOME" ? credit - debit : debit - credit;
    return { code: a.code, name: a.name, amount };
  };

  const income = accounts.filter((a) => a.type === "INCOME").map(rowFor);
  const expense = accounts.filter((a) => a.type === "EXPENSE").map(rowFor);
  const incomeTotal = income.reduce((s, r) => s + r.amount, 0);
  const expenseTotal = expense.reduce((s, r) => s + r.amount, 0);

  return {
    from: range.from,
    to: range.to,
    income,
    expense,
    incomeTotal,
    expenseTotal,
    netSurplus: incomeTotal - expenseTotal,
  };
}

/** Balance sheet as of a date. Equity includes net surplus not yet closed. */
export async function balanceSheet(orgId: string, asOf: Date) {
  const accounts = await prisma.account.findMany({
    where: { orgId },
    include: {
      journalLines: {
        where: { entry: { entryDate: { lte: asOf } } },
        select: { debit: true, credit: true },
      },
    },
    orderBy: { code: "asc" },
  });

  const signed = (a: (typeof accounts)[number]) => {
    const debit = a.journalLines.reduce((s, l) => s + Number(l.debit), 0);
    const credit = a.journalLines.reduce((s, l) => s + Number(l.credit), 0);
    const net = debit - credit;
    return DEBIT_NORMAL[a.type] ? net : -net;
  };

  const section = (type: AccountType) => {
    const rows = accounts
      .filter((a) => a.type === type)
      .map((a) => ({ code: a.code, name: a.name, amount: signed(a) }))
      .filter((r) => Math.abs(r.amount) > 0.005);
    return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
  };

  const assets = section("ASSET");
  const liabilities = section("LIABILITY");
  const equityAccounts = section("EQUITY");

  const incomeToDate = accounts
    .filter((a) => a.type === "INCOME")
    .reduce((s, a) => s + signed(a), 0);
  const expenseToDate = accounts
    .filter((a) => a.type === "EXPENSE")
    .reduce((s, a) => s + signed(a), 0);
  const netSurplus = incomeToDate - expenseToDate;

  const equityRows: ReportRow[] = [
    ...equityAccounts.rows,
    { code: "—", name: "Net surplus to date", amount: netSurplus },
  ];
  const equityTotal = equityAccounts.total + netSurplus;

  return {
    asOf,
    assets,
    liabilities,
    equity: { rows: equityRows, total: equityTotal },
    balanced:
      Math.abs(assets.total - (liabilities.total + equityTotal)) < 0.01,
  };
}
