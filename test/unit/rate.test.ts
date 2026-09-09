import { describe, it, expect } from "vitest";
import {
  typeDefaultRate,
  resolvePropertyRate,
  toTypeRateDefaults,
  TYPE_RATE_FIELD,
  ALL_PROPERTY_TYPES,
  PROPERTY_TYPE_LABEL,
} from "@/lib/rate";

const defaults = {
  typeRateResidential: 1500,
  typeRateCommercial: 5000,
  typeRateTownhouse: null,
};

describe("typeDefaultRate", () => {
  it("returns the configured rate for the type", () => {
    expect(typeDefaultRate(defaults, "RESIDENTIAL")).toBe(1500);
    expect(typeDefaultRate(defaults, "COMMERCIAL")).toBe(5000);
  });
  it("returns null when that type has no default", () => {
    expect(typeDefaultRate(defaults, "TOWNHOUSE")).toBeNull();
  });
});

describe("TYPE_RATE_FIELD", () => {
  it("maps each type to its Organization column", () => {
    expect(TYPE_RATE_FIELD.RESIDENTIAL).toBe("typeRateResidential");
    expect(TYPE_RATE_FIELD.COMMERCIAL).toBe("typeRateCommercial");
    expect(TYPE_RATE_FIELD.TOWNHOUSE).toBe("typeRateTownhouse");
  });
});

describe("property types", () => {
  it("ALL_PROPERTY_TYPES covers condo units and parking slots", () => {
    expect(ALL_PROPERTY_TYPES).toContain("CONDO_UNIT");
    expect(ALL_PROPERTY_TYPES).toContain("PARKING_SLOT");
    expect(ALL_PROPERTY_TYPES).toHaveLength(5);
  });
  it("every type has a label", () => {
    for (const t of ALL_PROPERTY_TYPES)
      expect(PROPERTY_TYPE_LABEL[t]?.length).toBeGreaterThan(0);
  });
  it("typeDefaultRate is null for a type with no default column", () => {
    expect(
      typeDefaultRate(
        {
          typeRateResidential: 1500,
          typeRateCommercial: 5000,
          typeRateTownhouse: 2200,
        },
        "CONDO_UNIT"
      )
    ).toBeNull();
  });
});

describe("toTypeRateDefaults", () => {
  it("coerces Decimal-ish values and preserves nulls", () => {
    expect(
      toTypeRateDefaults({
        typeRateResidential: "1500.00",
        typeRateCommercial: null,
        typeRateTownhouse: 2200,
      })
    ).toEqual({
      typeRateResidential: 1500,
      typeRateCommercial: null,
      typeRateTownhouse: 2200,
    });
  });
});

describe("resolvePropertyRate", () => {
  it("prefers the rate plan over everything", () => {
    expect(
      resolvePropertyRate(
        { ratePlanRate: 1800, customRate: 999, type: "RESIDENTIAL" },
        defaults
      )
    ).toBe(1800);
  });
  it("falls back to the custom rate when there is no plan", () => {
    expect(
      resolvePropertyRate({ customRate: 1650, type: "RESIDENTIAL" }, defaults)
    ).toBe(1650);
  });
  it("falls back to the type default when there is neither", () => {
    expect(resolvePropertyRate({ type: "COMMERCIAL" }, defaults)).toBe(5000);
  });
  it("returns null when nothing applies", () => {
    expect(resolvePropertyRate({ type: "TOWNHOUSE" }, defaults)).toBeNull();
  });
  it("treats a zero custom rate as a real value, not absent", () => {
    expect(
      resolvePropertyRate({ customRate: 0, type: "RESIDENTIAL" }, defaults)
    ).toBe(0);
  });
});
