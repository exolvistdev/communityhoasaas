import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { voteSummary } from "@/lib/votes";
import { seedCondo, resetCondoOrg, CONDO_SUBDOMAIN } from "../../prisma/seed-condo";
import { hasTestDb } from "../fixtures";

describe.skipIf(!hasTestDb)("condo demo seed", () => {
  afterAll(async () => {
    await resetCondoOrg(prisma);
    await prisma.$disconnect();
  });

  // The seed runs ~150 sequential writes; generous over a remote pooler.
  it("builds a working condominium org and tears back down cleanly", { timeout: 180_000 }, async () => {
    await resetCondoOrg(prisma);
    const org = await seedCondo(prisma, {});

    expect(org.communityType).toBe("CONDOMINIUM");
    expect(org.duesRateMode).toBe("PER_SQM");
    expect(org.voteWeightMode).toBe("BY_FLOOR_AREA");

    // buildings + units
    expect(await prisma.building.count({ where: { orgId: org.id } })).toBe(2);
    const units = await prisma.property.findMany({ where: { orgId: org.id } });
    expect(units).toHaveLength(8);
    expect(units.filter((u) => u.type === "PARKING_SLOT")).toHaveLength(2);

    // per-sqm dues baked on: 85 × 32.5 = 2762.5
    const ta1203 = units.find((u) => u.unitNumber === "TA-1203")!;
    expect(Number(ta1203.monthlyRate)).toBe(2762.5);
    // every unit has an invoice for the current period
    expect(await prisma.invoice.count({ where: { property: { orgId: org.id } } })).toBe(8);

    // the seeded resolution fails on floor area despite 3 YES vs 2 NO units
    const vote = await prisma.boardVote.findFirstOrThrow({ where: { orgId: org.id } });
    const s = await voteSummary(vote.id);
    expect(s.weightMode).toBe("BY_FLOOR_AREA");
    expect(s.tally.no).toBeGreaterThan(s.tally.yes);
    expect(s.outcome).toBe("FAILED");

    // a finalized board of 3
    expect(await prisma.trustee.count({ where: { orgId: org.id } })).toBe(3);
    const chair = await prisma.trustee.findFirstOrThrow({
      where: { orgId: org.id, position: "CHAIRPERSON" },
    });
    expect(chair.name).toBeTruthy();

    // teardown leaves nothing
    await resetCondoOrg(prisma);
    expect(
      await prisma.organization.findUnique({ where: { subdomain: CONDO_SUBDOMAIN } })
    ).toBeNull();
    expect(await prisma.building.count({ where: { orgId: org.id } })).toBe(0);
    expect(await prisma.property.count({ where: { orgId: org.id } })).toBe(0);
  });
});
