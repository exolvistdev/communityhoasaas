import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyLateFees } from "@/lib/late-fees";
import { assertLedgerBalances } from "@/lib/ledger";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
  issueInvoice,
} from "../fixtures";

const SUB = "test-latefees";

describe.skipIf(!hasTestDb)("applyLateFees", () => {
  let orgId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({
      name: "Late Fee Test HOA",
      subdomain: SUB,
      lateFeeEnabled: true,
      lateFeeType: "FIXED",
      lateFeeAmount: 200,
      lateFeeGraceDays: 3,
      lateFeeMaxOccurrences: 2,
    });
    orgId = org.id;

    const p = await createTestProperty(orgId, { monthlyRate: 1500 });
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await issueInvoice(p.id, {
      amount: 1500,
      period: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`,
      dueDate: new Date(Date.now() - 40 * 86_400_000),
    });
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("charges one late fee, and is idempotent within the same month", async () => {
    const first = await applyLateFees(orgId);
    expect(first.applied).toBe(1);

    const second = await applyLateFees(orgId);
    expect(second.applied).toBe(0);

    const fees = await prisma.invoice.findMany({
      where: { property: { orgId }, lateFeeParentId: { not: null } },
    });
    expect(fees).toHaveLength(1);
    expect(Number(fees[0].amount)).toBe(200);

    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
  });
});
