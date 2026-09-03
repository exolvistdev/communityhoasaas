import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { incomeStatement } from "@/lib/ledger";
import {
  parseReportRange,
  eachMonth,
  monthlyLedgerSeries,
  cashTrend,
  monthlyCollectionSeries,
} from "@/lib/reports";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
  issueInvoice,
  recordPayment,
} from "../fixtures";

const SUB = "test-reports-charts";

describe.skipIf(!hasTestDb)("monthly chart series", () => {
  let orgId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "Charts Test HOA", subdomain: SUB });
    orgId = org.id;
    const p = await createTestProperty(orgId, { monthlyRate: 1500 });

    // Back-date two invoices into different months (issueInvoice can't set
    // createdAt, so nudge the row + its journal entry afterwards).
    const jul = await issueInvoice(p.id, { amount: 1500, period: "2026-07" });
    const aug = await issueInvoice(p.id, { amount: 2000, period: "2026-08" });
    await prisma.invoice.update({
      where: { id: jul.id },
      data: { createdAt: new Date("2026-07-05T04:00:00Z") },
    });
    await prisma.journalEntry.updateMany({
      where: { invoiceId: jul.id },
      data: { entryDate: new Date("2026-07-05T04:00:00Z") },
    });
    await prisma.invoice.update({
      where: { id: aug.id },
      data: { createdAt: new Date("2026-08-05T04:00:00Z") },
    });
    await prisma.journalEntry.updateMany({
      where: { invoiceId: aug.id },
      data: { entryDate: new Date("2026-08-05T04:00:00Z") },
    });

    // Pay July's dues in July (recordPayment posts entryDate = paidAt).
    await recordPayment(jul.id, 1500, { paidAt: new Date("2026-07-20T04:00:00Z") });
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("monthlyLedgerSeries income ties to the single-window income statement", async () => {
    const range = parseReportRange({ from: "2026-07-01", to: "2026-08-31" });
    const months = eachMonth(range);
    const series = await monthlyLedgerSeries(orgId, months);

    const seriesIncome = series.reduce((s, m) => s + m.income, 0);
    const is = await incomeStatement(orgId, { from: range.from, to: range.to });
    expect(seriesIncome).toBeCloseTo(is.incomeTotal, 2);

    expect(series.find((m) => m.key === "2026-07")!.dues).toBeCloseTo(1500, 2);
    expect(series.find((m) => m.key === "2026-08")!.dues).toBeCloseTo(2000, 2);
  });

  it("cashTrend carries the month-end cash balance forward", async () => {
    const months = eachMonth(
      parseReportRange({ from: "2026-07-01", to: "2026-08-31" })
    );
    const cash = await cashTrend(orgId, months);
    expect(cash.find((m) => m.key === "2026-07")!.cash).toBeCloseTo(1500, 2);
    expect(cash.find((m) => m.key === "2026-08")!.cash).toBeCloseTo(1500, 2);
  });

  it("monthlyCollectionSeries surfaces openingAR, billed, collected and a bounded rate", async () => {
    const months = eachMonth(
      parseReportRange({ from: "2026-07-01", to: "2026-08-31" })
    );
    const series = await monthlyCollectionSeries(orgId, months);
    const jul = series.find((m) => m.key === "2026-07")!;
    const aug = series.find((m) => m.key === "2026-08")!;

    expect(jul.openingAR).toBe(0); // nothing billed before July
    expect(jul.billed).toBeCloseTo(1500, 2);
    expect(jul.collected).toBeCloseTo(1500, 2);
    expect(aug.openingAR).toBeCloseTo(0, 2); // July fully collected
    expect(aug.billed).toBeCloseTo(2000, 2);
    for (const m of series)
      if (m.rate != null) {
        expect(m.rate).toBeGreaterThanOrEqual(0);
        expect(m.rate).toBeLessThanOrEqual(1.0001);
      }
  });
});
