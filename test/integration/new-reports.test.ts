import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { postLateFeeIssued, postBillIssued, postBillPayment } from "@/lib/ledger";
import { parseReportRange, lateFeesReport, vendorSpendReport } from "@/lib/reports";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
  issueInvoice,
} from "../fixtures";

const SUB = "test-new-reports";

describe.skipIf(!hasTestDb)("late-fees + vendor-spend reports", () => {
  let orgId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "New Reports HOA", subdomain: SUB });
    orgId = org.id;
    const p = await createTestProperty(orgId, {
      monthlyRate: 1500,
      homeownerName: "Juan",
    });

    // a dues invoice + a late-fee child booked against it
    const dues = await issueInvoice(p.id, { amount: 1500, period: "2026-09" });
    const fee = await prisma.invoice.create({
      data: {
        propertyId: p.id,
        amount: 150,
        dueDate: new Date("2026-09-25T04:00:00Z"),
        status: "SENT",
        memo: "Late fee — 2026-09",
        lateFeeParentId: dues.id,
      },
    });
    await postLateFeeIssued(fee.id);
    await prisma.invoice.update({
      where: { id: fee.id },
      data: { createdAt: new Date("2026-09-20T04:00:00Z") },
    });

    // a vendor bill, half paid inside the period
    const vendor = await prisma.vendor.create({
      data: { orgId, name: "GreenScape" },
    });
    const b = await prisma.bill.create({
      data: {
        orgId,
        vendorId: vendor.id,
        description: "September landscaping",
        amount: 4000,
        billDate: new Date("2026-09-05T04:00:00Z"),
        dueDate: new Date("2026-09-20T04:00:00Z"),
        expenseAccountCode: "5100",
      },
    });
    await postBillIssued(b.id);
    const bp = await prisma.billPayment.create({
      data: {
        billId: b.id,
        amount: 1500,
        method: "BANK_TRANSFER",
        paidAt: new Date("2026-09-15T04:00:00Z"),
      },
    });
    await postBillPayment(bp.id);
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("lateFeesReport surfaces the fee, its parent period and the occurrence count", async () => {
    const r = await lateFeesReport(
      orgId,
      parseReportRange({ from: "2026-09-01", to: "2026-09-30" })
    );
    expect(r.count).toBe(1);
    expect(r.total).toBe(150);
    expect(r.rows[0].relatedInvoice).toBe("September 2026");
    expect(r.rows[0].occurrenceThisYear).toBe(1);
    expect(r.repeatOffenders[0].value).toBe(1);
    expect(r.monthly.at(-1)?.value).toBe(150);
  });

  it("vendorSpendReport rolls the bill up by vendor and category", async () => {
    const r = await vendorSpendReport(
      orgId,
      parseReportRange({ from: "2026-09-01", to: "2026-09-30" })
    );
    const green = r.vendors.find((v) => v.vendorName === "GreenScape")!;
    expect(green.totalBilled).toBe(4000);
    expect(green.totalPaid).toBe(1500);
    expect(green.openBalance).toBe(2500);
    expect(green.category).toBe("Utilities");
    expect(r.byCategory.find((c) => c.name === "Utilities")?.value).toBe(4000);
  });
});
