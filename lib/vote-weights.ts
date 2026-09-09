import { prisma } from "@/lib/prisma";
import { resolveUnitWeight, isWeighted } from "@/lib/weight";
import type { UnitStanding } from "@/lib/good-standing";
import type { VoteWeightMode } from "@prisma/client";

export type OrgVoteWeights = {
  mode: VoteWeightMode;
  /** propertyId → voting weight, for units currently in good standing only. */
  byProperty: Map<string, number>;
  /** Σ of byProperty — the denominator quorum is measured against. */
  eligibleWeight: number;
  /** in-good-standing units that carry 0 weight under a weighted mode
   *  (no floor area / share entered) — surfaced as a setup warning. */
  missingFigure: number;
};

/**
 * Resolve every in-good-standing unit's voting weight for an org, given the
 * standing map from `orgUnitStanding`. Under ONE_UNIT_ONE_VOTE every weight is
 * 1, so callers get exactly the old unit-count behaviour for free.
 */
export async function orgVoteWeights(
  orgId: string,
  standing: Map<string, UnitStanding>
): Promise<OrgVoteWeights> {
  const [org, props] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { voteWeightMode: true },
    }),
    prisma.property.findMany({
      where: { orgId, archivedAt: null },
      select: { id: true, floorArea: true, commonAreaShare: true },
    }),
  ]);

  const mode = org.voteWeightMode;
  const byProperty = new Map<string, number>();
  let missingFigure = 0;

  for (const p of props) {
    if (!(standing.get(p.id)?.inGoodStanding ?? false)) continue;
    const w = resolveUnitWeight(mode, {
      floorArea: p.floorArea == null ? null : Number(p.floorArea),
      commonAreaShare:
        p.commonAreaShare == null ? null : Number(p.commonAreaShare),
    });
    byProperty.set(p.id, w);
    if (isWeighted(mode) && w === 0) missingFigure++;
  }

  const eligibleWeight = [...byProperty.values()].reduce((s, w) => s + w, 0);
  return { mode, byProperty, eligibleWeight, missingFigure };
}

/** Round a weighted count for display (2 dp, trailing zeros trimmed). */
export function fmtWeight(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}
