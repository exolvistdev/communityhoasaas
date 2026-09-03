import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  postFineIssued,
  postPaymentReceived,
  assertLedgerBalances,
  arLedgerBalance,
  incomeStatement,
} from "@/lib/ledger";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
} from "../fixtures";

const SUB = "test-violations";

async function accountBalance(orgId: string, code: string) {
  const lines = await prisma.journalLine.findMany({
    where: { entry: { orgId }, account: { code } },
  });
  return lines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
}

describe.skipIf(!hasTestDb)("fine notices", () => {
  let orgId: string;
  let propertyId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "Violation Test HOA", subdomain: SUB });
    orgId = org.id;
    propertyId = (await createTestProperty(orgId, { monthlyRate: 1500 })).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("a fine posts to 4300 Fine Income and shows on the SOA", async () => {
    const violation = await prisma.violation.create({
      data: {
        orgId,
        propertyId,
        category: "PARKING",
        description: "Blocked the fire lane",
        occurredAt: new Date(),
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        propertyId,
        amount: 750,
        period: null,
        dueDate: new Date(),
        status: "SENT",
        memo: "Fine — Unit — Parking (notice 1)",
      },
    });
    await postFineIssued(invoice.id);
    await prisma.fineNotice.create({
      data: {
        violationId: violation.id,
        orgId,
        noticeNumber: 1,
        amount: 750,
        invoiceId: invoice.id,
        dueDate: new Date(),
      },
    });

    expect(await accountBalance(orgId, "4300")).toBeCloseTo(750, 2);
    expect(await arLedgerBalance(orgId)).toBeCloseTo(750, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);

    const stmt = await buildStatement(propertyId, parseStatementRange({}));
    expect(stmt?.closingBalance).toBeCloseTo(750, 2);
    expect(stmt?.lines.some((l) => /Fine/.test(l.description))).toBe(true);

    const pnl = await incomeStatement(orgId, { from: null, to: new Date() });
    expect(pnl.income.find((r) => r.code === "4300")?.amount).toBeCloseTo(750, 2);
  });

  it("paying a fine clears it from the ledger", async () => {
    const inv = await prisma.invoice.findFirstOrThrow({
      where: { propertyId, memo: { startsWith: "Fine" } },
    });
    const payment = await prisma.payment.create({
      data: {
        invoiceId: inv.id,
        amount: 750,
        method: "CASH",
        status: "CONFIRMED",
        allocations: { create: [{ invoiceId: inv.id, amount: 750 }] },
      },
    });
    await postPaymentReceived(payment.id);

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    expect(after.status).toBe("PAID");
    expect(await arLedgerBalance(orgId)).toBeCloseTo(0, 2);
    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
  });
});
