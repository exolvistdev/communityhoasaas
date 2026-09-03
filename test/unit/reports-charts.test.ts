import { describe, it, expect } from "vitest";
import {
  parseReportRange,
  eachMonth,
  bucketLedgerByMonth,
  type MonthBucket,
} from "@/lib/reports";

/* ── eachMonth ───────────────────────────────────────────────────── */

describe("eachMonth", () => {
  it("one bucket per month across a multi-month window, oldest first", () => {
    const months = eachMonth(
      parseReportRange({ from: "2026-03-15", to: "2026-06-10" })
    );
    expect(months.map((m) => m.key)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
    expect(months[0].label).toBe("Mar '26");
  });

  it("caps at the trailing 12 months when the window is longer", () => {
    const months = eachMonth(
      parseReportRange({ from: "2020-01-01", to: "2026-06-30" })
    );
    expect(months).toHaveLength(12);
    expect(months[0].key).toBe("2025-07");
    expect(months[11].key).toBe("2026-06");
  });

  it("is a single bucket for a within-month window", () => {
    const months = eachMonth(
      parseReportRange({ from: "2026-09-02", to: "2026-09-20" })
    );
    expect(months.map((m) => m.key)).toEqual(["2026-09"]);
  });

  it("each bucket spans its whole month and no more", () => {
    const [feb] = eachMonth(
      parseReportRange({ from: "2026-02-10", to: "2026-02-15" })
    );
    const days = (feb.end.getTime() - feb.start.getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(27); // Feb 2026 has 28 days
    expect(days).toBeLessThan(29);
  });
});

/* ── bucketLedgerByMonth ─────────────────────────────────────────── */

describe("bucketLedgerByMonth", () => {
  const months: MonthBucket[] = eachMonth(
    parseReportRange({ from: "2026-08-01", to: "2026-09-30" })
  );
  const line = (
    code: string,
    type: string,
    entryDate: string,
    debit: number,
    credit: number
  ) => ({
    debit,
    credit,
    entry: { entryDate: new Date(entryDate) },
    account: { type, code, name: `Account ${code}` },
  });

  it("splits income by account and sums expenses per month", () => {
    const rows = bucketLedgerByMonth(
      [
        line("4000", "INCOME", "2026-08-10T04:00:00Z", 0, 1500),
        line("4100", "INCOME", "2026-08-12T04:00:00Z", 0, 100),
        line("4300", "INCOME", "2026-09-01T04:00:00Z", 0, 500),
        line("4200", "INCOME", "2026-09-03T04:00:00Z", 0, 200),
        line("5100", "EXPENSE", "2026-09-05T04:00:00Z", 800, 0),
      ],
      months
    );
    const aug = rows.find((r) => r.key === "2026-08")!;
    const sep = rows.find((r) => r.key === "2026-09")!;
    expect(aug.dues).toBe(1500);
    expect(aug.lateFees).toBe(100);
    expect(aug.income).toBe(1600);
    expect(aug.expense).toBe(0);
    expect(sep.fines).toBe(500);
    expect(sep.otherIncome).toBe(200);
    expect(sep.expense).toBe(800);

    // per-account rows for the month drill-down
    expect(aug.incomeRows.map((r) => [r.code, r.amount])).toEqual([
      ["4000", 1500],
      ["4100", 100],
    ]);
    expect(sep.expenseRows).toEqual([
      { code: "5100", name: "Account 5100", amount: 800 },
    ]);
    expect(aug.expenseRows).toEqual([]);
  });

  it("ignores lines dated outside the month list", () => {
    const rows = bucketLedgerByMonth(
      [line("4000", "INCOME", "2026-01-05T04:00:00Z", 0, 999)],
      months
    );
    expect(rows.every((r) => r.income === 0)).toBe(true);
  });

  it("nets debits against credits within an income account", () => {
    const rows = bucketLedgerByMonth(
      [
        line("4000", "INCOME", "2026-08-10T04:00:00Z", 0, 1500),
        line("4000", "INCOME", "2026-08-20T04:00:00Z", 400, 0), // a reversal
      ],
      months
    );
    expect(rows.find((r) => r.key === "2026-08")!.dues).toBe(1100);
  });
});
