import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordElectionBallot, electionSummary } from "@/lib/elections";
import { voteSummary } from "@/lib/votes";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
  issueInvoice,
} from "../fixtures";

const SUB = "test-election-voting";

describe.skipIf(!hasTestDb)("election voting + delinquency on resolutions", () => {
  let orgId: string;
  let electionId: string;
  let voteId: string;
  const props: string[] = [];
  const candidateIds: string[] = [];

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({
      name: "Voting Test HOA",
      subdomain: SUB,
      electionArrearsMonths: 3,
    });
    orgId = org.id;

    for (let i = 0; i < 3; i++)
      props.push((await createTestProperty(orgId, { unitNumber: `V-${i + 1}` })).id);

    const wide = {
      opensAt: new Date(Date.now() - 86_400_000),
      closesAt: new Date(Date.now() + 30 * 86_400_000),
    };
    electionId = (
      await prisma.election.create({
        data: {
          orgId,
          title: "Now open",
          description: "x",
          seats: 2,
          status: "OPEN",
          quorumPct: 50,
          termMonths: 12,
          ...wide,
        },
      })
    ).id;
    for (const name of ["Alice", "Bob", "Cara"])
      candidateIds.push(
        (await prisma.electionCandidate.create({ data: { electionId, name } })).id
      );

    voteId = (
      await prisma.boardVote.create({
        data: {
          orgId,
          title: "A motion",
          description: "x",
          status: "OPEN",
          quorumPct: 50,
          threshold: "MAJORITY",
          ...wide,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("records a 'vote for up to N' ballot and caps it at the seat count", async () => {
    const ok = await recordElectionBallot({
      electionId,
      propertyId: props[0],
      candidateIds: [candidateIds[0], candidateIds[1]],
    });
    expect(ok).toEqual({ ok: true, picks: 2 });

    const tooMany = await recordElectionBallot({
      electionId,
      propertyId: props[1],
      candidateIds: candidateIds, // 3 > 2 seats
    });
    expect(tooMany.ok).toBe(false);
  });

  it("an abstain ballot has no votes but still counts toward quorum", async () => {
    await recordElectionBallot({
      electionId,
      propertyId: props[1],
      candidateIds: [],
    });
    const s = await electionSummary(electionId);
    const b = s.ballots.find((x) => x.propertyId === props[1]);
    expect(b?.abstain).toBe(true);
    expect(b?.votes).toHaveLength(0);
    expect(s.cast).toBe(2); // props[0] + props[1]
    expect(s.tally.rows.find((r) => r.candidateId === candidateIds[0])?.votes).toBe(1);
  });

  it("replacing a ballot swaps its picks", async () => {
    await recordElectionBallot({
      electionId,
      propertyId: props[0],
      candidateIds: [candidateIds[2]],
    });
    const s = await electionSummary(electionId);
    expect(s.tally.rows.find((r) => r.candidateId === candidateIds[0])?.votes).toBe(0);
    expect(s.tally.rows.find((r) => r.candidateId === candidateIds[2])?.votes).toBe(1);
  });

  it("a delinquent unit's ballot is excluded from a resolution vote's tally + quorum", async () => {
    // all 3 units vote YES
    for (const p of props)
      await prisma.ballot.create({
        data: { voteId, propertyId: p, choice: "YES" },
      });

    let s = await voteSummary(voteId);
    expect(s.eligibleUnits).toBe(3);
    expect(s.tally.yes).toBe(3);
    expect(s.suspendedUnits).toBe(0);

    // put V-3 four dues invoices behind
    for (let m = 1; m <= 4; m++)
      await issueInvoice(props[2], {
        amount: 1000,
        period: `2025-0${m}`,
        dueDate: new Date(`2025-0${m}-05T00:00:00Z`),
      });

    s = await voteSummary(voteId);
    expect(s.suspendedUnits).toBe(1);
    expect(s.eligibleUnits).toBe(2);
    expect(s.tally.yes).toBe(2); // V-3's YES no longer counts
    expect(s.ballots.find((b) => b.propertyId === props[2])?.suspended).toBe(true);
  });
});
