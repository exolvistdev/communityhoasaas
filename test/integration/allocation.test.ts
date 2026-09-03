import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  postCreditApplied,
  assertLedgerBalances,
  arLedgerBalance,
  balanceSheet,
  trialBalance,
} from "@/lib/ledger";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
  issueInvoice,
  recordPayment,
} from "../fixtures";

const SUB = "test-allocation";

/** 2100 Resident Credit balance for an org, straight from the ledger. */
async function creditLedgerBalance(orgId: string) {
  const lines = await prisma.journalLine.findMany({
    where: { entry: { orgId }, account: { code: "2100" } },
  });
  return lines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
}

describe.skipIf(!hasTestDb)("payment allocation + resident credit", () => {
  let orgId: string;
  let propertyId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "Allocation Test HOA", subdomain: SUB });
    orgId = org.id;
    propertyId = (await createTestProperty(orgId, { monthlyRate: 1500 })).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("splits one payment across three invoices → all PAID, AR at zero", async () => {
    const invs = [];
    for (const period of ["2026-01", "2026-02", "2026-03"])
      invs.push(await issueInvoice(propertyId, { amount: 1500, period }));

    await recordPayment(invs[0].id, 4500, {
      allocations: invs.map((i) => ({ invoiceId: i.id, amount: 1500 })),
    });

    for (const i of invs) {
      const after = await prisma.invoice.findUniqueOrThrow({ where: { id: i.id } });
      expect(after.status).toBe("PAID");
    }
    expect(await arLedgerBalance(orgId)).toBeCloseTo(0, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
    expect((await trialBalance(orgId)).balanced).toBe(true);
  });

  it("an overpayment lands in resident credit (2100 == Property.creditBalance)", async () => {
    const inv = await issueInvoice(propertyId, { amount: 1500, period: "2026-04" });
    await recordPayment(inv.id, 2000, {
      allocations: [{ invoiceId: inv.id, amount: 1500 }],
    });

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.status).toBe("PAID");

    const prop = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    expect(Number(prop.creditBalance)).toBeCloseTo(500, 2);
    expect(await creditLedgerBalance(orgId)).toBeCloseTo(500, 2);
    expect((await balanceSheet(orgId, new Date())).balanced).toBe(true);
  });

  it("credit auto-applies to a later invoice and clears 2100", async () => {
    const inv = await issueInvoice(propertyId, { amount: 1500, period: "2026-05" });

    // simulate generateMonthlyInvoices' credit step
    const applied = 500;
    const ca = await prisma.creditApplication.create({
      data: { orgId, propertyId, invoiceId: inv.id, amount: applied },
    });
    await prisma.property.update({
      where: { id: propertyId },
      data: { creditBalance: { decrement: applied } },
    });
    await postCreditApplied(ca.id);

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.status).toBe("PARTIALLY_PAID"); // 500 of 1500

    const prop = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    expect(Number(prop.creditBalance)).toBeCloseTo(0, 2);
    expect(await creditLedgerBalance(orgId)).toBeCloseTo(0, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
  });
});
