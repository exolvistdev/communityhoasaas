import type { VoteWeightMode } from "@prisma/client";

// Pure vote-weighting helper — safe to import from client components.

export type WeightableUnit = {
  floorArea: number | null;
  commonAreaShare: number | null;
};

/**
 * How much one unit's ballot counts.
 *  ONE_UNIT_ONE_VOTE → always 1
 *  BY_FLOOR_AREA      → the unit's floor area (raw sqm; only ratios matter)
 *  BY_COMMON_SHARE    → its master-deed share, falling back to floor area
 * A unit with no usable figure under a weighted mode contributes 0 — it can't
 * reach quorum or sway a tally until its floor area / share is entered.
 */
export function resolveUnitWeight(
  mode: VoteWeightMode,
  unit: WeightableUnit
): number {
  if (mode === "ONE_UNIT_ONE_VOTE") return 1;
  if (mode === "BY_COMMON_SHARE")
    return positive(unit.commonAreaShare) ?? positive(unit.floorArea) ?? 0;
  // BY_FLOOR_AREA
  return positive(unit.floorArea) ?? 0;
}

const positive = (n: number | null): number | null =>
  n != null && n > 0 ? n : null;

/** True for the modes that need a per-unit figure to work. */
export function isWeighted(mode: VoteWeightMode): boolean {
  return mode !== "ONE_UNIT_ONE_VOTE";
}
