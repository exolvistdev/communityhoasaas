import { describe, it, expect } from "vitest";
import { displayUnit } from "@/lib/homeowner";

describe("displayUnit", () => {
  it("returns null when there are no links", () => {
    expect(displayUnit(null)).toBeNull();
    expect(displayUnit(undefined)).toBeNull();
    expect(displayUnit([])).toBeNull();
  });

  it("prefers the primary unit", () => {
    expect(
      displayUnit([
        { isPrimary: false, property: { unitNumber: "Blk 1 Lot 3" } },
        { isPrimary: true, property: { unitNumber: "Blk 1 Lot 1" } },
      ])
    ).toBe("Blk 1 Lot 1");
  });

  it("falls back to the first link when none is primary", () => {
    expect(
      displayUnit([
        { isPrimary: false, property: { unitNumber: "Blk 2 Lot 5" } },
        { isPrimary: false, property: { unitNumber: "Blk 9 Lot 9" } },
      ])
    ).toBe("Blk 2 Lot 5");
  });

  it("returns null when the chosen link has no property", () => {
    expect(displayUnit([{ isPrimary: true, property: null }])).toBeNull();
  });
});
