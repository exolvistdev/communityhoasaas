import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  postBillIssued,
  postBillPayment,
  postBillVoided,
  assertLedgerBalances,
  balanceSheet,
  incomeStatement,
} from "@/lib/ledger";
import { payablesAging } from "@/lib/reports";
import { hasTestDb, resetTestOrg, createTestOrg } from "../fixtures";

const SUB = "test-bills";

async function apBalance(orgId: string) {
  const lines = await prisma.journalLine.findMany({
    where: { entry: { orgId }, account: { code: "2000" } },
  });
  return lines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
}

describe.skipIf(!hasTestDb)("vendors & bills (accounts payable)", () => {
  let orgId: string;
  let vendorId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "Bills Test HOA", subdomain: SUB });
    orgId = org.id;
    vendorId = (
      await prisma.vendor.create({ data: { orgId, name: "Acme Services" } })
    ).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  const mkBill = (amount: number, dueDate: Date) =>
    prisma.bill.create({
      data: {
        orgId,
        vendorId,
        description: "Test bill",
        amount,
        billDate: new Date("2026-01-01"),
        dueDate,
        status: "UNPAID",
        expenseAccountCode: "5000",
      },
    });

  it("issuing a bill books the expense and an A/P liability", async () => {
    const bill = await mkBill(10000, new Date("2026-02-01"));
    await postBillIssued(bill.id);

    expect(await apBalance(orgId)).toBeCloseTo(10000, 2);
    const pnl = await incomeStatement(orgId, {
      from: null,
      to: new Date("2026-12-31"),
    });
    expect(pnl.expense.find((r) => r.code === "5000")?.amount).toBeCloseTo(10000, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);

    const bs = await balanceSheet(orgId, new Date("2026-12-31"));
    expect(bs.balanced).toBe(true);
    expect(bs.liabilities.rows.find((r) => r.code === "2000")?.amount).toBeCloseTo(
      10000,
      2
    );
  });

  it("paying it draws down A/P; partial → PARTIALLY_PAID, full → PAID", async () => {
    const bill = await prisma.bill.findFirstOrThrow({ where: { orgId } });

    const p1 = await prisma.billPayment.create({
      data: { billId: bill.id, amount: 4000, method: "BANK_TRANSFER" },
    });
    await postBillPayment(p1.id);
    expect(
      (await prisma.bill.findUniqueOrThrow({ where: { id: bill.id } })).status
    ).toBe("PARTIALLY_PAID");
    expect(await apBalance(orgId)).toBeCloseTo(6000, 2);

    const p2 = await prisma.billPayment.create({
      data: { billId: bill.id, amount: 6000, method: "BANK_TRANSFER" },
    });
    await postBillPayment(p2.id);
    expect(
      (await prisma.bill.findUniqueOrThrow({ where: { id: bill.id } })).status
    ).toBe("PAID");
    expect(await apBalance(orgId)).toBeCloseTo(0, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
  });

  it("voiding an unpaid bill reverses its entry", async () => {
    const bill = await mkBill(2500, new Date("2026-03-01"));
    await postBillIssued(bill.id);
    const apBefore = await apBalance(orgId);

    await postBillVoided(bill.id);
    await prisma.bill.update({ where: { id: bill.id }, data: { status: "VOID" } });

    expect(await apBalance(orgId)).toBeCloseTo(apBefore - 2500, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
  });

  it("payablesAging buckets an unpaid bill by its due date", async () => {
    const asOf = new Date("2026-04-15");
    const bill = await mkBill(3000, new Date("2026-03-01")); // ~45 days overdue
    await postBillIssued(bill.id);

    const ap = await payablesAging(orgId, asOf);
    const vendor = ap.vendors.find((v) => v.vendorId === vendorId);
    expect(vendor?.aging.d31_60).toBeCloseTo(3000, 2);
    expect(ap.totals.d31_60).toBeGreaterThanOrEqual(3000);
  });
});
