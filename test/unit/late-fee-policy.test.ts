import { describe, it, expect } from "vitest";
import { computeLateFee, lateFeeSummary } from "@/lib/late-fee-policy";

describe("computeLateFee", () => {
  it("FIXED is a flat amount regardless of the balance", () => {
    expect(computeLateFee({ lateFeeType: "FIXED", lateFeeAmount: 200 }, 1500)).toBe(200);
    expect(computeLateFee({ lateFeeType: "FIXED", lateFeeAmount: 200 }, 50)).toBe(200);
  });

  it("PERCENT is a share of the remaining balance, rounded to cents", () => {
    expect(computeLateFee({ lateFeeType: "PERCENT", lateFeeAmount: 10 }, 1500)).toBe(150);
    expect(computeLateFee({ lateFeeType: "PERCENT", lateFeeAmount: 5 }, 1333.33)).toBe(66.67);
  });

  it("treats a missing/NaN amount as zero", () => {
    expect(
      computeLateFee({ lateFeeType: "FIXED", lateFeeAmount: NaN }, 1000)
    ).toBe(0);
  });
});

describe("lateFeeSummary", () => {
  const base = {
    lateFeeEnabled: true,
    lateFeeType: "FIXED" as const,
    lateFeeAmount: 200,
    lateFeeGraceDays: 3,
    lateFeeMaxOccurrences: 2,
  };

  it("says so when disabled", () => {
    expect(lateFeeSummary({ ...base, lateFeeEnabled: false })).toMatch(/Off/);
  });

  it("describes a flat recurring fee with a grace period", () => {
    const s = lateFeeSummary(base);
    expect(s).toContain("₱200");
    expect(s).toContain("3 days after the due date");
    expect(s).toContain("up to 2 times");
  });

  it("describes a percent one-time fee with no grace", () => {
    const s = lateFeeSummary({
      ...base,
      lateFeeType: "PERCENT",
      lateFeeAmount: 5,
      lateFeeGraceDays: 0,
      lateFeeMaxOccurrences: 1,
    });
    expect(s).toContain("5% of the overdue balance");
    expect(s).toContain("the day after it falls due");
    expect(s).toContain("once");
  });
});
