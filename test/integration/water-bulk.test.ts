import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { assertLedgerBalances, balanceSheet } from "@/lib/ledger";
import { recordReading, billBulk } from "@/lib/water-billing";
import {
  hasTestDb,
  resetTestOrg,
  createTestOrg,
  createTestProperty,
} from "../fixtures";

const SUB = "test-water-bulk";
const PERIOD = "2026-08";

describe.skipIf(!hasTestDb)("EXTERNAL_BULK water billing", () => {
  let orgId: string;
  let actorId: string;
  const meters: string[] = [];

  beforeAll(async () => {
    await resetTestOrg(SUB);
    const org = await createTestOrg({
      name: "Bulk Water HOA",
      subdomain: SUB,
      waterSource: "EXTERNAL_BULK",
      waterBillingEnabled: true,
      waterLossPolicy: "DISTRIBUTE",
    });
    orgId = org.id;
    actorId = (
      await prisma.user.create({
        data: { orgId, email: "staff@test-water-bulk.ph", fullName: "S", role: "ADMIN" },
      })
    ).id;
    const vendor = await prisma.vendor.create({
      data: { orgId, name: "Maynilad" },
    });
    await prisma.organization.update({
      where: { id: orgId },
      data: { waterUtilityVendorId: vendor.id },
    });

    // master meter + 3 unit sub-meters
    meters.push(
      (await prisma.waterMeter.create({ data: { orgId, kind: "SOURCE" } })).id
    );
    for (const [i, use] of [50, 30, 20].entries()) {
      const p = await createTestProperty(orgId, { unitNumber: `B-${i + 1}` });
      const m = await prisma.waterMeter.create({
        data: { orgId, propertyId: p.id, kind: "UNIT" },
      });
      meters.push(m.id);
      await recordReading({
        meterId: m.id,
        period: PERIOD,
        readingDate: new Date(`${PERIOD}-28T04:00:00Z`),
        currentReading: use,
        priorOverride: 0,
      });
    }
    // master meter reads 120 → 20 m³ system loss
    await recordReading({
      meterId: meters[0],
      period: PERIOD,
      readingDate: new Date(`${PERIOD}-28T04:00:00Z`),
      currentReading: 120,
      priorOverride: 0,
    });
  });

  afterAll(async () => {
    await resetTestOrg(SUB);
    await prisma.$disconnect();
  });

  it("books one 5150 bill, splits it into 4400 invoices, and stays balanced", async () => {
    const res = await billBulk({
      orgId,
      period: PERIOD,
      bulkAmount: 12000,
      billDate: new Date(`${PERIOD}-25T04:00:00Z`),
      actorId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(3);

    // one utility bill to 5150
    const bill = await prisma.bill.findFirstOrThrow({ where: { orgId } });
    expect(bill.expenseAccountCode).toBe("5150");
    expect(Number(bill.amount)).toBe(12000);

    const purchased = await prisma.journalLine.findMany({
      where: { account: { code: "5150" }, entry: { orgId } },
    });
    const expensed = purchased.reduce(
      (s, l) => s + Number(l.debit) - Number(l.credit),
      0
    );
    expect(expensed).toBeCloseTo(12000, 2);

    // 4400 credited == bulk bill (DISTRIBUTE, no admin fee)
    const income = await prisma.journalLine.findMany({
      where: { account: { code: "4400" }, entry: { orgId } },
    });
    const credited = income.reduce(
      (s, l) => s + Number(l.credit) - Number(l.debit),
      0
    );
    expect(credited).toBeCloseTo(12000, 2);

    // snapshot
    const run = await prisma.waterAllocationRun.findFirstOrThrow({
      where: { orgId, period: PERIOD },
    });
    expect(Number(run.systemLoss)).toBe(20);
    expect(run.unitsBilled).toBe(3);
    expect(run.billId).toBe(bill.id);

    expect((await assertLedgerBalances(orgId)).balanced).toBe(true);
    expect((await balanceSheet(orgId, new Date())).balanced).toBe(true);

    // re-run is rejected
    const again = await billBulk({
      orgId,
      period: PERIOD,
      bulkAmount: 12000,
      billDate: new Date(`${PERIOD}-25T04:00:00Z`),
      actorId,
    });
    expect(again.ok).toBe(false);
  });

  it("skips a sub-meter reading flagged low", async () => {
    const p = await createTestProperty(orgId, { unitNumber: "B-low" });
    const m = await prisma.waterMeter.create({
      data: { orgId, propertyId: p.id, kind: "UNIT", initialReading: 100 },
    });
    // current below the initial baseline → flag "low"
    const reading = await recordReading({
      meterId: m.id,
      period: "2026-09",
      readingDate: new Date("2026-09-28T04:00:00Z"),
      currentReading: 90,
    });
    expect(reading.flag).toBe("low");

    // one good reading so the run has something to bill
    const p2 = await createTestProperty(orgId, { unitNumber: "B-ok" });
    const m2 = await prisma.waterMeter.create({
      data: { orgId, propertyId: p2.id, kind: "UNIT" },
    });
    await recordReading({
      meterId: m2.id,
      period: "2026-09",
      readingDate: new Date("2026-09-28T04:00:00Z"),
      currentReading: 40,
      priorOverride: 0,
    });

    const res = await billBulk({
      orgId,
      period: "2026-09",
      bulkAmount: 3000,
      billDate: new Date("2026-09-25T04:00:00Z"),
      actorId,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(1); // the low reading was excluded

    const low = await prisma.meterReading.findFirstOrThrow({
      where: { meterId: m.id, period: "2026-09" },
    });
    expect(low.invoiceId).toBeNull();
  });
});
