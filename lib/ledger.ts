import { PrismaClient, Prisma, type AccountType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Standard chart-of-accounts codes every org gets on creation.
 * Keep this small for the MVP — expand once real bookkeeping needs surface.
 */
export const SEED_ACCOUNTS = [
  { code: "1000", name: "Cash", type: "ASSET" as const },
  { code: "1100", name: "Accounts Receivable — Dues", type: "ASSET" as const },
  { code: "4000", name: "HOA Dues Income", type: "INCOME" as const },
];

/**
 * Every money-moving action in the app should go through one of these
 * two functions rather than writing JournalEntry/JournalLine rows by hand.
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
      memo: `Dues invoice — unit ${invoice.property.unitNumber}`,
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

async function recalculateInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: { where: { status: "CONFIRMED" } } },
  });

  const paid = invoice.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

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

/**
 * Net balance of the Accounts Receivable — Dues account (code 1100) for an org,
 * straight from the ledger (debits − credits). Should always equal the sum of
 * every property's (invoiced − paid). Used by QA / audit checks to prove the
 * Invoice/Payment-derived statements agree with the double-entry ledger.
 */
export async function arLedgerBalance(orgId: string) {
  const lines = await prisma.journalLine.findMany({
    where: { entry: { orgId }, account: { code: "1100" } },
  });
  return lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
}

/** Sanity check you can run in a test or admin tool: every entry must net to zero. */
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
  /** signed so it reads on the account's natural side (always >= 0 in practice) */
  balance: number;
};

/**
 * Per-account debit/credit totals for the whole org — the classic trial
 * balance. `totalDebit` must equal `totalCredit` (SOW acceptance criterion #3).
 */
export async function trialBalance(orgId: string) {
  const accounts = await prisma.account.findMany({
    where: { orgId },
    include: { journalLines: { select: { debit: true, credit: true } } },
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
