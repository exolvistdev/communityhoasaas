import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordReading, billReadings } from "@/lib/water-billing";
import { waterReport, parseReportRange } from "@/lib/reports";
import { DEFAULT_WATER_BANDS } from "@/lib/water";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
} from "../fixtures";

const SUB = "test-water-report";

describe.skipIf(!hasTestDb)("waterReport", () => {
  let orgId: string;
  let actorId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({
      name: "Water Report HOA",
      subdomain: SUB,
      waterSource: "INTERNAL",
      waterBillingEnabled: true,
      waterServiceCharge: 100,
      waterRateBands: DEFAULT_WATER_BANDS,
    });
    orgId = org.id;
    actorId = (
      await prisma.user.create({
        data: { orgId, email: "s@test-water-report.ph", fullName: "S", role: "ADMIN" },
      })
    ).id;

    for (const [i, use] of [[0, 18], [1, 22]].entries()) {
      const p = await createTestProperty(orgId, {
        unitNumber: `WR-${i + 1}`,
        homeownerName: `Owner ${i + 1}`,
      });
      const m = await prisma.waterMeter.create({
        data: { orgId, propertyId: p.id, kind: "UNIT" },
      });
      await recordReading({
        meterId: m.id,
        period: "2026-07",
        readingDate: new Date("2026-07-28"),
        currentReading: use[1],
        priorOverride: 0,
      });
      await recordReading({
        meterId: m.id,
        period: "2026-08",
        readingDate: new Date("2026-08-28"),
        currentReading: use[1] * 2,
        priorOverride: use[1],
      });
    }
    await billReadings(orgId, "2026-07", actorId);
    await billReadings(orgId, "2026-08", actorId);
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("ties billed totals to the 4400 ledger and consumption to the readings", async () => {
    const range = parseReportRange({ from: "2026-07-01", to: "2026-08-31" });
    const report = await waterReport(orgId, range);

    expect(report.mode).toBe("INTERNAL");
    expect(report.rows).toHaveLength(2);
    expect(report.totals.bulkCost).toBeNull();

    // consumption: 18 + 22 in July, 18 + 22 in Aug = 80
    expect(report.totals.consumption).toBe(80);

    const water = await prisma.journalLine.findMany({
      where: { account: { code: "4400" }, entry: { orgId } },
    });
    const credited = water.reduce(
      (s, l) => s + Number(l.credit) - Number(l.debit),
      0
    );
    expect(report.totals.billed).toBeCloseTo(credited, 2);

    // monthly series has both months, newest last
    expect(report.monthly.at(-1)?.consumption).toBe(40);
  });
});
