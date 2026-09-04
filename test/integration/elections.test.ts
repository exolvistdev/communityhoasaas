import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { electionSummary, finalizeElection } from "@/lib/elections";
import { orgUnitStanding } from "@/lib/good-standing";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
  issueInvoice,
} from "../fixtures";

const SUB = "test-elections";

describe.skipIf(!hasTestDb)("board elections", () => {
  let orgId: string;
  let actorId: string;
  let electionId: string;
  const props: string[] = [];
  const homeownerIds: string[] = [];
  const candidateIds: string[] = [];

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({
      name: "Election Test HOA",
      subdomain: SUB,
      electionArrearsMonths: 3,
    });
    orgId = org.id;
    actorId = (
      await prisma.user.create({
        data: { orgId, email: "s@test-elections.ph", fullName: "S", role: "ADMIN" },
      })
    ).id;

    for (let i = 0; i < 4; i++) {
      const p = await createTestProperty(orgId, {
        unitNumber: `E-${i + 1}`,
        homeownerName: `Owner ${i + 1}`,
      });
      props.push(p.id);
      const h = await prisma.homeowner.findFirstOrThrow({
        where: { propertyId: p.id },
      });
      homeownerIds.push(h.id);
      // link a portal user to owner 1 (for the role-bump check)
      if (i === 0) {
        const u = await prisma.user.create({
          data: {
            orgId,
            email: "owner1@test-elections.ph",
            fullName: "Owner 1",
            role: "HOMEOWNER",
          },
        });
        await prisma.homeowner.update({ where: { id: h.id }, data: { userId: u.id } });
      }
    }

    electionId = (
      await prisma.election.create({
        data: {
          orgId,
          title: "2026 Board",
          description: "x",
          seats: 2,
          status: "OPEN",
          opensAt: new Date("2026-01-01T00:00:00Z"),
          closesAt: new Date("2026-03-01T00:00:00Z"),
          quorumPct: 50,
          termMonths: 12,
        },
      })
    ).id;

    for (const hid of homeownerIds.slice(0, 3)) {
      const c = await prisma.electionCandidate.create({
        data: {
          electionId,
          homeownerId: hid,
          name: (await prisma.homeowner.findUniqueOrThrow({ where: { id: hid } })).fullName,
        },
      });
      candidateIds.push(c.id);
    }
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("tallies 'vote for up to N' and checks quorum against units in good standing", async () => {
    // E-1 picks c0+c1; E-2 picks c0; E-3 picks c1 — c0=2, c1=2, c2=0
    const cast = async (propertyId: string, cands: string[]) => {
      const b = await prisma.electionBallot.create({
        data: { electionId, propertyId, abstain: cands.length === 0 },
      });
      for (const candidateId of cands)
        await prisma.electionVote.create({ data: { ballotId: b.id, candidateId } });
    };
    await cast(props[0], [candidateIds[0], candidateIds[1]]);
    await cast(props[1], [candidateIds[0]]);
    await cast(props[2], [candidateIds[1]]);

    const s = await electionSummary(electionId);
    expect(s.eligibleUnits).toBe(4);
    expect(s.cast).toBe(3);
    expect(s.quorumOK).toBe(true);
    expect(s.tally.rows.find((r) => r.candidateId === candidateIds[0])?.votes).toBe(2);
    expect(s.tally.winners.sort()).toEqual([candidateIds[0], candidateIds[1]].sort());
    expect(s.outcome).toBe("ELECTED");
  });

  it("suspends a unit that is electionArrearsMonths behind on dues", async () => {
    // E-4: 4 unpaid dues invoices, all past due
    for (let m = 1; m <= 4; m++)
      await issueInvoice(props[3], {
        amount: 1500,
        period: `2025-0${m}`,
        dueDate: new Date(`2025-0${m}-05T00:00:00Z`),
      });

    const standing = await orgUnitStanding(orgId, new Date("2026-02-01T00:00:00Z"));
    expect(standing.get(props[3])?.monthsBehind).toBe(4);
    expect(standing.get(props[3])?.inGoodStanding).toBe(false);
    expect(standing.get(props[0])?.inGoodStanding).toBe(true);

    // cast a ballot from the suspended unit — it must not count
    const b = await prisma.electionBallot.create({
      data: { electionId, propertyId: props[3] },
    });
    await prisma.electionVote.create({
      data: { ballotId: b.id, candidateId: candidateIds[2] },
    });

    const s = await electionSummary(electionId);
    expect(s.suspendedUnits).toBe(1);
    expect(s.eligibleUnits).toBe(3);
    expect(s.cast).toBe(3); // the suspended ballot is dropped
    expect(s.tally.rows.find((r) => r.candidateId === candidateIds[2])?.votes).toBe(0);
  });

  it("finalizeElection seats the winners as trustees and can bump the role", async () => {
    await prisma.election.update({
      where: { id: electionId },
      data: { status: "CLOSED" },
    });

    const res = await finalizeElection({ electionId, setBoardRole: true, actorId });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.trustees).toBe(2);

    const trustees = await prisma.trustee.findMany({ where: { orgId } });
    expect(trustees).toHaveLength(2);
    const t = trustees[0];
    expect(t.electionId).toBe(electionId);
    // termEnd = closesAt + 12 months
    expect(t.termEnd.getUTCFullYear()).toBe(2027);
    expect(t.termEnd.getUTCMonth()).toBe(2); // March

    const owner1 = await prisma.user.findFirstOrThrow({
      where: { email: "owner1@test-elections.ph" },
    });
    expect(owner1.role).toBe("BOARD_MEMBER");
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: actorId } });
    expect(admin.role).toBe("ADMIN"); // never downgraded

    // re-finalize is rejected
    const again = await finalizeElection({ electionId, setBoardRole: false, actorId });
    expect(again.ok).toBe(false);
  });
});

const SUB2 = "test-elections-elig";

describe.skipIf(!hasTestDb)("candidate eligibility (RA 9904)", () => {
  let orgId: string;
  let electionId: string;
  const cand: Record<string, string> = {}; // "A" | "B" | "C" -> candidateId
  const prop: Record<string, string> = {};

  beforeAll(async () => {
    await resetTestOrg(SUB2);
    orgId = (
      await createTestOrg({
        name: "Eligibility HOA",
        subdomain: SUB2,
        electionArrearsMonths: 3,
      })
    ).id;

    for (const key of ["A", "B", "C", "D"]) {
      const p = await createTestProperty(orgId, {
        unitNumber: `U-${key}`,
        homeownerName: `Owner ${key}`,
      });
      prop[key] = p.id;
    }

    electionId = (
      await prisma.election.create({
        data: {
          orgId,
          title: "Eligibility election",
          description: "x",
          seats: 2,
          status: "OPEN",
          opensAt: new Date("2026-01-01T00:00:00Z"),
          closesAt: new Date("2026-03-01T00:00:00Z"),
          quorumPct: 25,
          termMonths: 12,
        },
      })
    ).id;

    for (const key of ["A", "B", "C"]) {
      const h = await prisma.homeowner.findFirstOrThrow({
        where: { propertyId: prop[key] },
      });
      cand[key] = (
        await prisma.electionCandidate.create({
          data: { electionId, homeownerId: h.id, name: `Owner ${key}` },
        })
      ).id;
    }

    // C=4, A=3, B=1 → clean winners [A, C]
    const cast = async (propertyId: string, ids: string[]) => {
      const b = await prisma.electionBallot.create({
        data: { electionId, propertyId },
      });
      for (const candidateId of ids)
        await prisma.electionVote.create({ data: { ballotId: b.id, candidateId } });
    };
    await cast(prop.A, [cand.C, cand.A]);
    await cast(prop.B, [cand.C, cand.A]);
    await cast(prop.C, [cand.C, cand.B]);
    await cast(prop.D, [cand.C, cand.A]);
  });

  afterAll(async () => {
    await resetTestOrg(SUB2);
    await prisma.$disconnect();
  });

  it("seats the runner-up when a leading candidate's unit falls delinquent", async () => {
    const before = await electionSummary(electionId);
    expect(before.tally.winners.sort()).toEqual([cand.A, cand.C].sort());
    expect(before.suspendedCandidates).toBe(0);

    // Owner A's unit goes 3 dues invoices past due
    for (let m = 1; m <= 3; m++)
      await issueInvoice(prop.A, {
        amount: 1500,
        period: `2025-0${m}`,
        dueDate: new Date(`2025-0${m}-05T00:00:00Z`),
      });

    const after = await electionSummary(electionId);
    expect(after.suspendedCandidates).toBe(1);
    expect(after.candidateEligible[cand.A]).toBe(false);
    // A is off the winner list; B (the runner-up) takes the seat next to C
    expect(after.tally.winners.sort()).toEqual([cand.B, cand.C].sort());
  });
});
