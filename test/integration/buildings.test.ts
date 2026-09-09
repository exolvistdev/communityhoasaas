import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteOrgCascade } from "@/lib/org-teardown";
import { hasTestDb, resetTestOrg, createTestOrg } from "../fixtures";

const SUB = "test-buildings";

describe.skipIf(!hasTestDb)("buildings", () => {
  let orgId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    orgId = (
      await createTestOrg({
        name: "Sample Tower Condo",
        subdomain: SUB,
        communityType: "CONDOMINIUM",
      })
    ).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("a property can belong to a building and carry condo detail", async () => {
    const tower = await prisma.building.create({
      data: { orgId, name: "Tower A" },
    });
    const unit = await prisma.property.create({
      data: {
        orgId,
        unitNumber: "TA-1203",
        type: "CONDO_UNIT",
        monthlyRate: 3825,
        buildingId: tower.id,
        floor: "12",
        floorArea: "45.0",
        commonAreaShare: "1.2500",
      },
      include: { building: true },
    });

    expect(unit.building?.name).toBe("Tower A");
    expect(Number(unit.floorArea)).toBe(45);
    expect(Number(unit.commonAreaShare)).toBe(1.25);
  });

  it("building name is unique per org", async () => {
    await expect(
      prisma.building.create({ data: { orgId, name: "Tower A" } })
    ).rejects.toThrow();
  });

  it("deleteOrgCascade removes buildings with the org", async () => {
    await deleteOrgCascade(prisma, orgId);
    expect(await prisma.building.count({ where: { orgId } })).toBe(0);
    expect(await prisma.property.count({ where: { orgId } })).toBe(0);
    expect(
      await prisma.organization.findUnique({ where: { id: orgId } })
    ).toBeNull();

    // re-create so afterAll's resetTestOrg is a no-op, not an error
    orgId = (
      await createTestOrg({ name: "Recreated", subdomain: SUB })
    ).id;
  });
});
