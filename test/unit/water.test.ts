import { describe, it, expect } from "vitest";
import {
  computeWaterCharge,
  validateBands,
  bandBreakdown,
  parseRateBands,
  waterMetered,
  type RateBand,
} from "@/lib/water";

const bands: RateBand[] = [
  { upToM3: 10, pricePerM3: 20 },
  { upToM3: 20, pricePerM3: 30 },
  { upToM3: null, pricePerM3: 50 },
];

describe("computeWaterCharge", () => {
  it("charges only the service fee at zero consumption", () => {
    expect(computeWaterCharge(0, bands, 150)).toBe(150);
  });
  it("stays inside the first band", () => {
    expect(computeWaterCharge(6, bands, 150)).toBe(150 + 6 * 20);
  });
  it("spans bands", () => {
    // 10@20 + 10@30 + 5@50 = 200 + 300 + 250 = 750, + 150 service
    expect(computeWaterCharge(25, bands, 150)).toBe(900);
  });
  it("is exact at a band boundary", () => {
    expect(computeWaterCharge(10, bands, 0)).toBe(200);
    expect(computeWaterCharge(20, bands, 0)).toBe(500);
  });
  it("treats an empty band set as just the service charge", () => {
    expect(computeWaterCharge(30, [], 100)).toBe(100);
  });
  it("never goes negative", () => {
    expect(computeWaterCharge(-5, bands, 0)).toBe(0);
  });
});

describe("validateBands", () => {
  it("accepts a well-formed ascending set", () => {
    expect(validateBands(bands)).toEqual([]);
  });
  it("flags an empty set", () => {
    expect(validateBands([])).toHaveLength(1);
  });
  it("flags a non-ascending limit", () => {
    expect(
      validateBands([
        { upToM3: 20, pricePerM3: 10 },
        { upToM3: 15, pricePerM3: 20 },
        { upToM3: null, pricePerM3: 30 },
      ])
    ).not.toEqual([]);
  });
  it("flags a missing open-ended last band", () => {
    expect(
      validateBands([{ upToM3: 10, pricePerM3: 20 }])
    ).toContain("The last band must be open-ended (no upper limit).");
  });
  it("flags a non-positive price", () => {
    expect(validateBands([{ upToM3: null, pricePerM3: 0 }])).not.toEqual([]);
  });
});

describe("bandBreakdown", () => {
  it("splits consumption per band", () => {
    expect(bandBreakdown(25, bands)).toEqual([
      { label: "0–10 m³ @ ₱20", m3: 10, amount: 200 },
      { label: "10–20 m³ @ ₱30", m3: 10, amount: 300 },
      { label: "over 20 m³ @ ₱50", m3: 5, amount: 250 },
    ]);
  });
});

describe("waterMetered", () => {
  it("is true only for the two metered models", () => {
    expect(waterMetered("INTERNAL")).toBe(true);
    expect(waterMetered("EXTERNAL_BULK")).toBe(true);
    expect(waterMetered("EXTERNAL_DIRECT")).toBe(false);
    expect(waterMetered("UNSET")).toBe(false);
  });
});

describe("parseRateBands", () => {
  it("keeps well-formed entries and the null cap", () => {
    expect(
      parseRateBands([
        { upToM3: 10, pricePerM3: 20 },
        { upToM3: null, pricePerM3: 40 },
        { junk: true },
      ])
    ).toEqual([
      { upToM3: 10, pricePerM3: 20 },
      { upToM3: null, pricePerM3: 40 },
    ]);
  });
  it("is empty for non-arrays", () => {
    expect(parseRateBands(null)).toEqual([]);
    expect(parseRateBands({})).toEqual([]);
  });
});
