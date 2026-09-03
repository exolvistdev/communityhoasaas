import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { assertLedgerBalances, balanceSheet } from "@/lib/ledger";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import { recordReading, billReadings, previewBilling } from "@/lib/water-billing";
import { DEFAULT_WATER_BANDS } from "@/lib/water";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
} from "../fixtures";

const SUB = "test-water";

describe.skipIf(!hasTestDb)("water metering + billing", () => {
  let orgId: string;
  let propertyId: string;
  let meterId: string;

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({
      name: "Water Test HOA",
      subdomain: SUB,
      waterBillingEnabled: true,
      waterServiceCharge: 100,
      waterRateBands: DEFAULT_WATER_BANDS,
    });
    orgId = org.id;
    propertyId = (await createTestProperty(orgId, { unitNumber: "W-1" })).id;
    meterId = (
      await prisma.waterMeter.create({ data: { orgId, propertyId } })
    ).id;
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("recordReading computes consumption + a tiered amount and upserts", async () => {
    const r = await recordReading({
      meterId,
      period: "2026-08",
      readingDate: new Date("2026-08-28T04:00:00Z"),
      currentReading: 125,
      priorOverride: 100, // 25 m³
    });
    // DEFAULT bands: 10@20 + 10@30 + 5@40 = 700, + 100 service = 800
    expect(Number(r.consumption)).toBe(25);
    expect(Number(r.amount)).toBe(800);

    // re-record (correction) — still one row for the period
    await recordReading({
      meterId,
      period: "2026-08",
      readingDate: new Date("2026-08-28T04:00:00Z"),
      currentReading: 120,
      priorOverride: 100, // 20 m³
    });
    const rows = await prisma.meterReading.findMany({ where: { meterId } });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].consumption)).toBe(20);
  });

  it("billReadings issues a period:null invoice posted to 4400 and links it back", async () => {
    const before = await previewBilling(orgId, "2026-08");
    expect(before.count).toBe(1);

    const { created } = await billReadings(orgId, "2026-08", (
      await prisma.user.create({
        data: { orgId, email: "staff@test-water.ph", fullName: "S", role: "ADMIN" },
      })
    ).id);
    expect(created).toBe(1);

    const reading = await prisma.meterReading.findFirstOrThrow({ where: { meterId } });
    expect(reading.invoiceId).not.toBeNull();
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: reading.invoiceId! },
    });
    expect(invoice.period).toBeNull();
    expect(invoice.memo).toContain("m³");

    // 4400 credited by the invoice amount
    const water = await prisma.journalLine.findMany({
      where: { account: { code: "4400" }, entry: { orgId } },
    });
    const credited = water.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
    expect(credited).toBeCloseTo(Number(invoice.amount), 2);

    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
    expect((await balanceSheet(orgId, new Date())).balanced).toBe(true);

    // shows on the SOA
    const stmt = await buildStatement(propertyId, parseStatementRange({}));
    expect(stmt?.lines.some((l) => l.description.includes("m³"))).toBe(true);

    // re-running is a no-op
    expect((await billReadings(orgId, "2026-08", "x")).created).toBe(0);
  });
});
