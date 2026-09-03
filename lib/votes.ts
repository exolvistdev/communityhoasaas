import { prisma } from "@/lib/prisma";
import {
  quorumMet,
  resolutionOutcome,
  voteTally,
  type VoteOutcome,
  type VoteTally,
} from "@/lib/vote";

/** Full picture of a vote: ballots, quorum against eligible units, and outcome. */
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

  const eligibleUnits = await prisma.property.count({
    where: { orgId: vote.orgId, archivedAt: null },
  });

  const tally: VoteTally = voteTally(vote.ballots);
  const quorumOK = quorumMet(tally.total, eligibleUnits, vote.quorumPct);
  const outcome: VoteOutcome = resolutionOutcome(tally, vote.threshold, quorumOK);

  return { vote, ballots: vote.ballots, eligibleUnits, tally, quorumOK, outcome };
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
