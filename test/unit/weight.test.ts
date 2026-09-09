import { describe, it, expect } from "vitest";
import { resolveUnitWeight, isWeighted } from "@/lib/weight";

describe("resolveUnitWeight", () => {
  it("ONE_UNIT_ONE_VOTE is always 1", () => {
    expect(
      resolveUnitWeight("ONE_UNIT_ONE_VOTE", { floorArea: null, commonAreaShare: null })
    ).toBe(1);
    expect(
      resolveUnitWeight("ONE_UNIT_ONE_VOTE", { floorArea: 90, commonAreaShare: 2 })
    ).toBe(1);
  });

  it("BY_FLOOR_AREA is the floor area, 0 when missing", () => {
    expect(
      resolveUnitWeight("BY_FLOOR_AREA", { floorArea: 45.5, commonAreaShare: 9 })
    ).toBe(45.5);
    expect(
      resolveUnitWeight("BY_FLOOR_AREA", { floorArea: null, commonAreaShare: 9 })
    ).toBe(0);
    expect(
      resolveUnitWeight("BY_FLOOR_AREA", { floorArea: 0, commonAreaShare: 9 })
    ).toBe(0);
  });

  it("BY_COMMON_SHARE prefers the share, falls back to floor area, then 0", () => {
    expect(
      resolveUnitWeight("BY_COMMON_SHARE", { floorArea: 45, commonAreaShare: 1.25 })
    ).toBe(1.25);
    expect(
      resolveUnitWeight("BY_COMMON_SHARE", { floorArea: 45, commonAreaShare: null })
    ).toBe(45);
    expect(
      resolveUnitWeight("BY_COMMON_SHARE", { floorArea: null, commonAreaShare: null })
    ).toBe(0);
  });
});

describe("isWeighted", () => {
  it("is true for everything but one-unit-one-vote", () => {
    expect(isWeighted("ONE_UNIT_ONE_VOTE")).toBe(false);
    expect(isWeighted("BY_FLOOR_AREA")).toBe(true);
    expect(isWeighted("BY_COMMON_SHARE")).toBe(true);
  });
});
