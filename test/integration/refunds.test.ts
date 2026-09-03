import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  postRefund,
  postInvoiceVoided,
  postInvoiceVoidedToCredit,
  assertLedgerBalances,
  arLedgerBalance,
  balanceSheet,
} from "@/lib/ledger";
import { invoicePaid } from "@/lib/invoice";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
  issueInvoice,
  recordPayment,
} from "../fixtures";

const SUB = "test-refunds";

async function creditLedgerBalance(orgId: string) {
  const lines = await prisma.journalLine.findMany({
    where: { entry: { orgId }, account: { code: "2100" } },
  });
  return lines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
}

describe.skipIf(!hasTestDb)("refunds + void-to-credit", () => {
  let orgId: string;
  let propertyId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "Refund Test HOA", subdomain: SUB });
    orgId = org.id;
    propertyId = (await createTestProperty(orgId, { monthlyRate: 1500 })).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("refunding carried credit clears 2100 and keeps the books balanced", async () => {
    const inv = await issueInvoice(propertyId, { amount: 1500, period: "2026-01" });
    await recordPayment(inv.id, 2000, {
      allocations: [{ invoiceId: inv.id, amount: 1500 }],
    });
    expect(await creditLedgerBalance(orgId)).toBeCloseTo(500, 2);

    // mirror issueRefund's transaction
    const refund = await prisma.refund.create({
      data: { orgId, propertyId, amount: 500, method: "BANK_TRANSFER", reason: "moved out" },
    });
    await prisma.property.update({
      where: { id: propertyId },
      data: { creditBalance: { decrement: 500 } },
    });
    await postRefund(refund.id);

    const prop = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    expect(Number(prop.creditBalance)).toBeCloseTo(0, 2);
    expect(await creditLedgerBalance(orgId)).toBeCloseTo(0, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
    expect((await balanceSheet(orgId, new Date())).balanced).toBe(true);
  });

  it("voiding a paid invoice moves the money to resident credit", async () => {
    const inv = await issueInvoice(propertyId, { amount: 1500, period: "2026-02" });
    await recordPayment(inv.id, 1000, {
      allocations: [{ invoiceId: inv.id, amount: 1000 }],
    });

    const arBefore = await arLedgerBalance(orgId);
    const creditBefore = await creditLedgerBalance(orgId);

    const full = await prisma.invoice.findUniqueOrThrow({
      where: { id: inv.id },
      include: {
        allocations: {
          where: { payment: { status: "CONFIRMED" } },
          select: { amount: true },
        },
        creditApplications: { select: { amount: true } },
      },
    });
    const toCredit = invoicePaid(full); // 1000

    await postInvoiceVoided(inv.id);
    await postInvoiceVoidedToCredit(inv.id, toCredit);
    await prisma.property.update({
      where: { id: propertyId },
      data: { creditBalance: { increment: toCredit } },
    });
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "VOID" } });

    // issue reversed the 1500 charge; void-to-credit moved the 1000 paid → 2100
    expect(await arLedgerBalance(orgId)).toBeCloseTo(arBefore - 1500 + toCredit, 2);
    expect(await creditLedgerBalance(orgId)).toBeCloseTo(creditBefore + toCredit, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);

    const prop = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    expect(Number(prop.creditBalance)).toBeCloseTo(toCredit, 2); // 0 + 1000
  });
});
