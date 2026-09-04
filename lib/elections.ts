import { prisma } from "@/lib/prisma";
import { quorumMet } from "@/lib/vote";
import { electionIsOpen, tallyElection, type ElectionTally } from "@/lib/election";
import { orgUnitStanding } from "@/lib/good-standing";
import { logAudit } from "@/lib/audit";
import { deliver, recipientSelect } from "@/lib/notifications";

export type ElectionOutcome = "ELECTED" | "RUNOFF" | "NO_QUORUM";

/** Full picture of an election: candidates, tally, quorum, projected winners. */
export async function electionSummary(electionId: string) {
  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId },
    include: {
      candidates: {
        orderBy: { name: "asc" },
        include: {
          homeowner: {
            select: {
              property: { select: { id: true, unitNumber: true } },
            },
          },
        },
      },
      ballots: {
        include: {
          property: { select: { unitNumber: true } },
          castBy: { select: { fullName: true } },
          viaProxy: { select: { grantorProperty: { select: { unitNumber: true } } } },
          votes: { select: { candidateId: true } },
        },
        orderBy: { property: { unitNumber: "asc" } },
      },
    },
  });

  const standing = await orgUnitStanding(election.orgId);
  const eligibleUnits = [...standing.values()].filter((s) => s.inGoodStanding).length;
  const suspendedUnits = standing.size - eligibleUnits;

  // ballots from a unit that's since fallen out of standing don't count
  const countedBallots = election.ballots.filter(
    (b) => standing.get(b.propertyId)?.inGoodStanding ?? false
  );
  const votes = countedBallots.flatMap((b) => b.votes);

  // RA 9904: a candidate whose own unit isn't in good standing can't be voted
  // for. Free-text candidates (no linked homeowner) are staff-vouched → eligible.
  const candidateEligible: Record<string, boolean> = {};
  for (const c of election.candidates) {
    const pid = c.homeowner?.property?.id ?? null;
    candidateEligible[c.id] = pid
      ? standing.get(pid)?.inGoodStanding ?? true
      : true;
  }
  const suspendedCandidates = election.candidates.filter(
    (c) => !c.withdrawn && !candidateEligible[c.id]
  ).length;

  const tally: ElectionTally = tallyElection(
    election.candidates.map((c) => ({
      id: c.id,
      name: c.name,
      // an ineligible candidate is treated like a withdrawal — off the winner
      // list, and the next in-good-standing candidate takes the seat
      withdrawn: c.withdrawn || !candidateEligible[c.id],
    })),
    votes,
    election.seats
  );

  const cast = countedBallots.length;
  const quorumOK = quorumMet(cast, eligibleUnits, election.quorumPct);
  const turnoutPct =
    eligibleUnits > 0 ? Math.round((cast / eligibleUnits) * 100) : 0;

  const outcome: ElectionOutcome = !quorumOK
    ? "NO_QUORUM"
    : tally.runoffNeeded
      ? "RUNOFF"
      : "ELECTED";

  return {
    election,
    candidates: election.candidates,
    ballots: election.ballots,
    tally,
    candidateEligible,
    suspendedCandidates,
    eligibleUnits,
    suspendedUnits,
    cast,
    quorumOK,
    turnoutPct,
    outcome,
  };
}

/**
 * Write a unit's election ballot (create or replace). Caller is responsible for
 * authorization + the good-standing check; this only validates the election is
 * open, the picks are real candidates, and the count fits the seats.
 */
export async function recordElectionBallot(input: {
  electionId: string;
  propertyId: string;
  candidateIds: string[];
  castById?: string | null;
  viaProxyId?: string | null;
}): Promise<{ ok: true; picks: number } | { ok: false; error: string }> {
  const election = await prisma.election.findUnique({
    where: { id: input.electionId },
    include: { candidates: { select: { id: true, withdrawn: true } } },
  });
  if (!election) return { ok: false, error: "Election not found" };
  if (!electionIsOpen(election))
    return { ok: false, error: "Voting is closed for this election." };

  const valid = new Set(
    election.candidates.filter((c) => !c.withdrawn).map((c) => c.id)
  );
  const picks = [...new Set(input.candidateIds)].filter((id) => valid.has(id));
  if (picks.length > election.seats)
    return {
      ok: false,
      error: `Pick at most ${election.seats} candidate${
        election.seats === 1 ? "" : "s"
      }.`,
    };

  await prisma.$transaction(async (tx) => {
    const ballot = await tx.electionBallot.upsert({
      where: {
        electionId_propertyId: {
          electionId: input.electionId,
          propertyId: input.propertyId,
        },
      },
      create: {
        electionId: input.electionId,
        propertyId: input.propertyId,
        castById: input.castById ?? null,
        viaProxyId: input.viaProxyId ?? null,
        abstain: picks.length === 0,
      },
      update: {
        castById: input.castById ?? null,
        viaProxyId: input.viaProxyId ?? null,
        abstain: picks.length === 0,
      },
    });
    await tx.electionVote.deleteMany({ where: { ballotId: ballot.id } });
    if (picks.length)
      await tx.electionVote.createMany({
        data: picks.map((candidateId) => ({ ballotId: ballot.id, candidateId })),
      });
  });

  return { ok: true, picks: picks.length };
}

type FinalizeResult =
  | { ok: true; trustees: number }
  | { ok: false; error: string };

/**
 * Turn a closed election's winners into `Trustee` rows. Blocked while a tie at
 * the last seat is unresolved (staff withdraw a candidate to break it).
 */
export async function finalizeElection(input: {
  electionId: string;
  setBoardRole: boolean;
  actorId: string;
}): Promise<FinalizeResult> {
  const s = await electionSummary(input.electionId);
  const { election, tally } = s;

  if (election.status !== "CLOSED")
    return { ok: false, error: "Close the election before finalizing it." };
  if (election.finalizedAt)
    return { ok: false, error: "This election has already been finalized." };
  if (!s.quorumOK)
    return { ok: false, error: "Quorum wasn't met — the election is invalid." };
  if (tally.runoffNeeded)
    return {
      ok: false,
      error:
        "There's a tie for the last seat. Withdraw a candidate to break it, then finalize.",
    };
  if (tally.winners.length === 0)
    return { ok: false, error: "No winners to seat." };

  const winners = election.candidates.filter((c) =>
    tally.winners.includes(c.id)
  );

  const termStart = election.closesAt;
  const termEnd = new Date(termStart);
  termEnd.setMonth(termEnd.getMonth() + election.termMonths);

  // homeowner → linked user (for the optional role bump)
  const homeownerIds = winners
    .map((c) => c.homeownerId)
    .filter((id): id is string => Boolean(id));
  const homeowners = homeownerIds.length
    ? await prisma.homeowner.findMany({
        where: { id: { in: homeownerIds } },
        select: { id: true, userId: true },
      })
    : [];
  const userByHomeowner = new Map(homeowners.map((h) => [h.id, h.userId]));

  await prisma.$transaction(async (tx) => {
    for (const c of winners) {
      const userId = c.homeownerId
        ? userByHomeowner.get(c.homeownerId) ?? null
        : null;
      await tx.trustee.create({
        data: {
          orgId: election.orgId,
          electionId: election.id,
          homeownerId: c.homeownerId,
          userId,
          name: c.name,
          position: "MEMBER",
          termStart,
          termEnd,
        },
      });
      if (input.setBoardRole && userId) {
        const u = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (u?.role === "HOMEOWNER" || u?.role === "GUARD")
          await tx.user.update({
            where: { id: userId },
            data: { role: "BOARD_MEMBER" },
          });
      }
    }
    await tx.election.update({
      where: { id: election.id },
      data: { finalizedAt: new Date() },
    });
  });

  await logAudit({
    action: "election.finalize",
    target: election.title,
    detail: `${winners.length} trustee${winners.length === 1 ? "" : "s"} seated`,
  });

  const residents = await prisma.user.findMany({
    where: { orgId: election.orgId, deactivatedAt: null, homeowners: { some: {} } },
    select: recipientSelect,
  });
  if (residents.length)
    await deliver({
      users: residents,
      type: "BOARD_ELECTION",
      title: `New board elected — ${election.title}`,
      body: `The results are in. The new Board of Trustees serves until ${termEnd.toLocaleDateString(
        "en-PH",
        { day: "numeric", month: "long", year: "numeric" }
      )}.`,
      href: "/portal/board",
    }).catch(() => {});

  return { ok: true, trustees: winners.length };
}
