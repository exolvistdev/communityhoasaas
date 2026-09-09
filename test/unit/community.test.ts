import { describe, it, expect } from "vitest";
import {
  COMMUNITY_TYPES,
  COMMUNITY_TYPE_OPTIONS,
  COMMUNITY_TYPE_LABEL,
  communityTypeDefaults,
} from "@/lib/community";

describe("community options", () => {
  it("every type has an option and a label", () => {
    expect(COMMUNITY_TYPE_OPTIONS.map((o) => o.value).sort()).toEqual(
      [...COMMUNITY_TYPES].sort()
    );
    for (const t of COMMUNITY_TYPES)
      expect(COMMUNITY_TYPE_LABEL[t].length).toBeGreaterThan(0);
  });
});

describe("communityTypeDefaults", () => {
  it("condos default to per-sqm dues + floor-area voting", () => {
    expect(communityTypeDefaults("CONDOMINIUM")).toEqual({
      duesRateMode: "PER_SQM",
      voteWeightMode: "BY_FLOOR_AREA",
    });
  });
  it("every other type keeps the column defaults", () => {
    for (const t of ["SUBDIVISION", "VILLAGE", "TOWNHOUSE", "MIXED"] as const)
      expect(communityTypeDefaults(t)).toEqual({});
  });
});
