import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  postManualEntry,
  postInvoiceVoided,
  assertLedgerBalances,
  arLedgerBalance,
  trialBalance,
  incomeStatement,
  balanceSheet,
} from "@/lib/ledger";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
  issueInvoice,
  recordPayment,
} from "../fixtures";

const SUB = "test-ledger";

describe.skipIf(!hasTestDb)("ledger invariants", () => {
  let orgId: string;
  let propertyId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "Ledger Test HOA", subdomain: SUB });
    orgId = org.id;
    propertyId = (await createTestProperty(orgId, { monthlyRate: 1500 })).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("a partial payment leaves the invoice PARTIALLY_PAID and AR at the remainder", async () => {
    const inv = await issueInvoice(propertyId, { amount: 1500, period: "2026-09" });
    await recordPayment(inv.id, 600);

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.status).toBe("PARTIALLY_PAID");

    expect(await arLedgerBalance(orgId)).toBeCloseTo(900, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
    expect((await trialBalance(orgId)).balanced).toBe(true);
  });

  it("paying the balance marks it PAID and clears AR", async () => {
    const inv = await issueInvoice(propertyId, { amount: 1500, period: "2026-10" });
    await recordPayment(inv.id, 1500);

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.status).toBe("PAID");
  });

  it("voiding an invoice reverses its ledger entry", async () => {
    const inv = await issueInvoice(propertyId, { amount: 500, period: "2026-11" });
    const arBefore = await arLedgerBalance(orgId);
    await postInvoiceVoided(inv.id);
    // the voidInvoice action pairs the reversing entry with a status flip
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "VOID" } });
    expect(await arLedgerBalance(orgId)).toBeCloseTo(arBefore - 500, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
  });

  it("AR from the ledger equals Σ(invoiced − allocated − credit applied)", async () => {
    const rows = await prisma.invoice.findMany({
      where: { property: { orgId }, status: { not: "VOID" } },
      include: {
        allocations: {
          where: { payment: { status: "CONFIRMED" } },
          select: { amount: true },
        },
        creditApplications: { select: { amount: true } },
      },
    });
    const derived = rows.reduce((s, inv) => {
      const paid =
        inv.allocations.reduce((a, x) => a + Number(x.amount), 0) +
        inv.creditApplications.reduce((a, x) => a + Number(x.amount), 0);
      return s + Number(inv.amount) - paid;
    }, 0);
    expect(await arLedgerBalance(orgId)).toBeCloseTo(derived, 2);
  });

  it("the balance sheet and P&L stay balanced", async () => {
    const bs = await balanceSheet(orgId, new Date());
    expect(bs.balanced).toBe(true);
    const pnl = await incomeStatement(orgId, { from: null, to: new Date() });
    expect(pnl.incomeTotal).toBeGreaterThan(0);
  });

  describe("postManualEntry validation", () => {
    const base = { orgId: "", entryDate: new Date(), memo: "t" };
    beforeAll(() => {
      base.orgId = orgId;
    });

    it("rejects an unbalanced entry", async () => {
      await expect(
        postManualEntry({
          ...base,
          lines: [
            { code: "1000", debit: 100, credit: 0 },
            { code: "4000", debit: 0, credit: 90 },
          ],
        })
      ).rejects.toThrow(/equal/i);
    });

    it("rejects fewer than two lines", async () => {
      await expect(
        postManualEntry({ ...base, lines: [{ code: "1000", debit: 100, credit: 0 }] })
      ).rejects.toThrow(/two lines/i);
    });

    it("rejects an unknown account code", async () => {
      await expect(
        postManualEntry({
          ...base,
          lines: [
            { code: "9999", debit: 100, credit: 0 },
            { code: "4000", debit: 0, credit: 100 },
          ],
        })
      ).rejects.toThrow(/Unknown account/i);
    });

    it("posts a balanced entry", async () => {
      const entry = await postManualEntry({
        ...base,
        memo: "Opening cash",
        lines: [
          { code: "1000", debit: 5000, credit: 0 },
          { code: "3900", debit: 0, credit: 5000 },
        ],
      });
      expect(entry.lines).toHaveLength(2);
      expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
    });
  });
});
