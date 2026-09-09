import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { electionSummary } from "@/lib/elections";
import { voteSummary } from "@/lib/votes";
import { hasTestDb, resetTestOrg, createTestOrg } from "../fixtures";

const SUB = "test-weighted";

describe.skipIf(!hasTestDb)("weighted voting", () => {
  let orgId: string;
  const unit: Record<string, string> = {};

  beforeAll(async () => {
    await resetTestOrg(SUB);
    orgId = (
      await createTestOrg({
        name: "Sample Tower Condo",
        subdomain: SUB,
        communityType: "CONDOMINIUM",
        voteWeightMode: "BY_FLOOR_AREA",
        electionArrearsMonths: 0,
      })
    ).id;

    // three units: one big, two small — big unit's ballot outweighs the pair
    for (const [name, area] of [
      ["BIG", "120.00"],
      ["S1", "30.00"],
      ["S2", "30.00"],
    ] as const) {
      const p = await prisma.property.create({
        data: {
          orgId,
          unitNumber: name,
          type: "CONDO_UNIT",
          monthlyRate: 0,
          floorArea: area,
        },
      });
      unit[name] = p.id;
    }
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("a resolution tally is measured in floor area, not unit count", async () => {
    const vote = await prisma.boardVote.create({
      data: {
        orgId,
        title: "Special assessment",
        description: "x",
        status: "OPEN",
        opensAt: new Date("2026-01-01"),
        closesAt: new Date("2026-02-01"),
        quorumPct: 50,
        threshold: "MAJORITY",
      },
    });
    // BIG votes NO (120), the two small units vote YES (60 total)
    await prisma.ballot.createMany({
      data: [
        { voteId: vote.id, propertyId: unit.BIG, choice: "NO" },
        { voteId: vote.id, propertyId: unit.S1, choice: "YES" },
        { voteId: vote.id, propertyId: unit.S2, choice: "YES" },
      ],
    });

    const s = await voteSummary(vote.id);
    expect(s.weightMode).toBe("BY_FLOOR_AREA");
    expect(s.eligibleWeight).toBe(180);
    expect(s.tally).toMatchObject({ yes: 60, no: 120, total: 180 });
    expect(s.quorumOK).toBe(true); // 180 / 180
    // 2 units to 1, but the motion FAILS on floor area
    expect(s.outcome).toBe("FAILED");
  });

  it("an election seats the candidate backed by more floor area", async () => {
    const election = await prisma.election.create({
      data: {
        orgId,
        title: "2026 Board of Directors",
        description: "x",
        seats: 1,
        status: "OPEN",
        opensAt: new Date("2026-01-01"),
        closesAt: new Date("2026-03-01"),
        quorumPct: 50,
        termMonths: 12,
      },
    });
    const [alice, bob] = await Promise.all([
      prisma.electionCandidate.create({
        data: { electionId: election.id, name: "Alice" },
      }),
      prisma.electionCandidate.create({
        data: { electionId: election.id, name: "Bob" },
      }),
    ]);

    // BIG (120) backs Alice; S1 + S2 (60) back Bob
    const mkBallot = async (propertyId: string, candidateId: string) => {
      const b = await prisma.electionBallot.create({
        data: { electionId: election.id, propertyId },
      });
      await prisma.electionVote.create({ data: { ballotId: b.id, candidateId } });
    };
    await mkBallot(unit.BIG, alice.id);
    await mkBallot(unit.S1, bob.id);
    await mkBallot(unit.S2, bob.id);

    const s = await electionSummary(election.id);
    expect(s.weightMode).toBe("BY_FLOOR_AREA");
    expect(s.castWeight).toBe(180);
    expect(s.tally.winners).toEqual([alice.id]); // 120 > 60
    const aliceRow = s.tally.rows.find((r) => r.candidateId === alice.id);
    expect(aliceRow?.votes).toBe(120);
  });
});
