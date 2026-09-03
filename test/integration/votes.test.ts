import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { voteSummary } from "@/lib/votes";
import { hasTestDb, resetTestOrg, createTestOrg, createTestProperty } from "../fixtures";

const SUB = "test-votes";

describe.skipIf(!hasTestDb)("board votes + proxy", () => {
  let orgId: string;
  let voteId: string;
  let p1: string;
  let p2: string;
  let holder: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({ name: "Votes Test HOA", subdomain: SUB });
    orgId = org.id;
    p1 = (await createTestProperty(orgId, { unitNumber: "V-1" })).id;
    p2 = (await createTestProperty(orgId, { unitNumber: "V-2" })).id;
    // a third non-archived unit so quorum math has 3 eligible
    await createTestProperty(orgId, { unitNumber: "V-3" });

    holder = (
      await prisma.user.create({
        data: { orgId, email: "holder@test-votes.ph", fullName: "Hank", role: "HOMEOWNER" },
      })
    ).id;

    voteId = (
      await prisma.boardVote.create({
        data: {
          orgId,
          title: "Test motion",
          description: "x",
          status: "OPEN",
          opensAt: new Date("2026-01-01T00:00:00Z"),
          closesAt: new Date("2026-12-31T00:00:00Z"),
          quorumPct: 60,
          threshold: "MAJORITY",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("one ballot per unit — upsert changes the choice", async () => {
    const upsert = (choice: "YES" | "NO" | "ABSTAIN") =>
      prisma.ballot.upsert({
        where: { voteId_propertyId: { voteId, propertyId: p1 } },
        create: { voteId, propertyId: p1, choice },
        update: { choice },
      });
    await upsert("YES");
    await upsert("NO"); // changed mind
    const rows = await prisma.ballot.findMany({ where: { voteId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].choice).toBe("NO");
  });

  it("a proxy holder casts for the grantor unit and it is recorded", async () => {
    const proxy = await prisma.voteProxy.create({
      data: { orgId, grantorPropertyId: p2, holderUserId: holder },
    });
    await prisma.ballot.create({
      data: {
        voteId,
        propertyId: p2,
        choice: "YES",
        castById: holder,
        viaProxyForId: proxy.id,
      },
    });
    const b = await prisma.ballot.findFirstOrThrow({ where: { voteId, propertyId: p2 } });
    expect(b.viaProxyForId).toBe(proxy.id);
  });

  it("voteSummary computes tally, quorum and outcome against eligible units", async () => {
    // p1 = NO, p2 = YES, 2 of 3 units cast = 66% >= 60% quorum
    const s = await voteSummary(voteId);
    expect(s.eligibleUnits).toBe(3);
    expect(s.tally).toMatchObject({ yes: 1, no: 1, total: 2 });
    expect(s.quorumOK).toBe(true);
    expect(s.outcome).toBe("FAILED"); // 1 yes / 1 no is not a majority
  });

  it("deleting the vote cascades its ballots", async () => {
    await prisma.boardVote.delete({ where: { id: voteId } });
    expect(await prisma.ballot.count({ where: { voteId } })).toBe(0);
  });
});
