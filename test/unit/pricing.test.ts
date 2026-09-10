import { describe, it, expect } from "vitest";
import {
  ratePerProperty,
  monthlyEstimate,
  bandRangeLabel,
  PRICING_BANDS,
} from "@/lib/pricing";

describe("ratePerProperty", () => {
  it("returns the entry rate at or below the first band", () => {
    expect(ratePerProperty(0)).toBe(7);
    expect(ratePerProperty(-10)).toBe(7);
    expect(ratePerProperty(1)).toBe(7);
    expect(ratePerProperty(500)).toBe(7);
  });

  it("steps down at each band boundary", () => {
    expect(ratePerProperty(501)).toBe(6);
    expect(ratePerProperty(1000)).toBe(6);
    expect(ratePerProperty(1001)).toBe(5);
    expect(ratePerProperty(50_000)).toBe(5);
  });

  it("floors a fractional count", () => {
    expect(ratePerProperty(500.9)).toBe(7);
    expect(ratePerProperty(501.1)).toBe(6);
  });
});

describe("monthlyEstimate", () => {
  it("multiplies the count by its band rate", () => {
    expect(monthlyEstimate(240)).toEqual({ count: 240, rate: 7, total: 1680 });
    expect(monthlyEstimate(800)).toEqual({ count: 800, rate: 6, total: 4800 });
    expect(monthlyEstimate(2000)).toEqual({ count: 2000, rate: 5, total: 10_000 });
  });

  it("clamps a negative / non-finite count to zero", () => {
    expect(monthlyEstimate(-5)).toEqual({ count: 0, rate: 7, total: 0 });
    expect(monthlyEstimate(NaN)).toEqual({ count: 0, rate: 7, total: 0 });
  });
});

describe("bandRangeLabel", () => {
  it("renders closed and open-ended bands", () => {
    expect(bandRangeLabel(PRICING_BANDS[0])).toBe("1 – 500 properties");
    expect(bandRangeLabel(PRICING_BANDS[2])).toBe("1,001+ properties");
    expect(bandRangeLabel(PRICING_BANDS[1], "lots")).toBe("501 – 1,000 lots");
  });
});
