import { prisma } from "@/lib/prisma";
import {
  quorumMet,
  resolutionOutcome,
  voteTally,
  type VoteOutcome,
  type VoteTally,
} from "@/lib/vote";
import { orgUnitStanding } from "@/lib/good-standing";

/** Full picture of a vote: ballots, quorum against eligible units, and outcome.
 *  A unit not in good standing (RA 9904 delinquency) is dropped from both the
 *  eligible count and the tally; its ballot is flagged `suspended`. */
export async function voteSummary(voteId: string) {
  const vote = await prisma.boardVote.findUniqueOrThrow({
    where: { id: voteId },
    include: {
      ballots: {
        include: {
          property: { select: { unitNumber: true } },
          castBy: { select: { fullName: true } },
          viaProxy: {
            select: {
              grantorProperty: { select: { unitNumber: true } },
              holderUser: { select: { fullName: true } },
            },
          },
        },
        orderBy: { property: { unitNumber: "asc" } },
      },
    },
  });

  const standing = await orgUnitStanding(vote.orgId);
  const eligibleUnits = [...standing.values()].filter((s) => s.inGoodStanding).length;
  const suspendedUnits = standing.size - eligibleUnits;

  const ballots = vote.ballots.map((b) => ({
    ...b,
    suspended: !(standing.get(b.propertyId)?.inGoodStanding ?? false),
  }));
  const counted = ballots.filter((b) => !b.suspended);

  const tally: VoteTally = voteTally(counted);
  const quorumOK = quorumMet(tally.total, eligibleUnits, vote.quorumPct);
  const outcome: VoteOutcome = resolutionOutcome(tally, vote.threshold, quorumOK);

  return { vote, ballots, eligibleUnits, suspendedUnits, tally, quorumOK, outcome };
}

/**
 * The units a resident may cast a ballot for: the ones they own/co-own directly,
 * plus any where they currently hold an active proxy.
 */
export async function controllableUnits(userId: string, orgId: string) {
  const [own, proxies] = await Promise.all([
    prisma.homeowner.findMany({
      where: { userId, property: { orgId, archivedAt: null } },
      select: { property: { select: { id: true, unitNumber: true } } },
    }),
    prisma.voteProxy.findMany({
      where: {
        holderUserId: userId,
        revokedAt: null,
        grantorProperty: { orgId, archivedAt: null },
      },
      select: {
        id: true,
        grantorProperty: { select: { id: true, unitNumber: true } },
        grantorPropertyId: true,
        note: true,
      },
    }),
  ]);

  const ownIds = new Set(own.map((h) => h.property.id));

  return {
    own: [...new Map(own.map((h) => [h.property.id, h.property])).values()],
    // a proxy for a unit you already own directly is redundant — drop it
    proxy: proxies
      .filter((p) => !ownIds.has(p.grantorPropertyId))
      .map((p) => ({
        proxyId: p.id,
        propertyId: p.grantorPropertyId,
        unitNumber: p.grantorProperty.unitNumber,
        note: p.note,
      })),
  };
}
