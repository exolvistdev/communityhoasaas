import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { reapplyPerSqm } from "@/lib/rate-reapply";
import { issueInvoice } from "../fixtures";
import { hasTestDb, resetTestOrg, createTestOrg } from "../fixtures";

const SUB = "test-per-sqm";

describe.skipIf(!hasTestDb)("per-sqm dues", () => {
  let orgId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    orgId = (
      await createTestOrg({
        name: "Sample Tower Condo",
        subdomain: SUB,
        communityType: "CONDOMINIUM",
        duesRateMode: "PER_SQM",
        duesRatePerSqm: "85.00",
      })
    ).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("reapplyPerSqm sets monthlyRate = rate × floor area, and only for eligible units", async () => {
    const a = await prisma.property.create({
      data: {
        orgId,
        unitNumber: "TA-1203",
        type: "CONDO_UNIT",
        monthlyRate: 0,
        floorArea: "45.00",
      },
    });
    const b = await prisma.property.create({
      data: {
        orgId,
        unitNumber: "TA-1204",
        type: "CONDO_UNIT",
        monthlyRate: 0,
        floorArea: "32.40",
      },
    });
    // no floor area — left alone
    const c = await prisma.property.create({
      data: { orgId, unitNumber: "COMMERCIAL-1", type: "COMMERCIAL", monthlyRate: 9999 },
    });

    const n = await reapplyPerSqm(prisma, orgId, 85);
    expect(n).toBe(2);

    const [pa, pb, pc] = await Promise.all([
      prisma.property.findUniqueOrThrow({ where: { id: a.id } }),
      prisma.property.findUniqueOrThrow({ where: { id: b.id } }),
      prisma.property.findUniqueOrThrow({ where: { id: c.id } }),
    ]);
    expect(Number(pa.monthlyRate)).toBe(3825); // 85 × 45
    expect(Number(pb.monthlyRate)).toBe(2754); // 85 × 32.4
    expect(Number(pc.monthlyRate)).toBe(9999); // untouched
  });

  it("billing uses the per-sqm monthlyRate that was baked onto the unit", async () => {
    const unit = await prisma.property.create({
      data: {
        orgId,
        unitNumber: "TA-1500",
        type: "CONDO_UNIT",
        monthlyRate: 0,
        floorArea: "50.00",
      },
    });
    await reapplyPerSqm(prisma, orgId, 85);
    const fresh = await prisma.property.findUniqueOrThrow({ where: { id: unit.id } });
    const inv = await issueInvoice(unit.id, {
      amount: Number(fresh.monthlyRate),
      period: "2026-09",
    });
    expect(Number(inv.amount)).toBe(4250); // 85 × 50
  });
});
