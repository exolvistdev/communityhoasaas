import { prisma } from "@/lib/prisma";
import { periodLabel } from "@/lib/format";
import {
  postWaterChargeIssued,
  postCreditApplied,
  postBillIssued,
} from "@/lib/ledger";
import { logAudit } from "@/lib/audit";
import { deliver, recipientSelect, type Recipient } from "@/lib/notifications";
import {
  allocateBulk,
  bandBreakdownText,
  computeWaterCharge,
  formatConsumption,
  parseRateBands,
  type RateBand,
} from "@/lib/water";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type WaterConfig = {
  enabled: boolean;
  serviceCharge: number;
  bands: RateBand[];
};

export function waterConfig(org: {
  waterBillingEnabled: boolean;
  waterServiceCharge: unknown;
  waterRateBands: unknown;
}): WaterConfig {
  return {
    enabled: org.waterBillingEnabled,
    serviceCharge: Number(org.waterServiceCharge ?? 0),
    bands: parseRateBands(org.waterRateBands),
  };
}

export type MeterRow = {
  id: string;
  kind: "UNIT" | "SOURCE";
  propertyId: string | null;
  unitNumber: string | null;
  archived: boolean;
  serialNumber: string | null;
  initialReading: number;
  latest: {
    period: string;
    currentReading: number;
    consumption: number;
    amount: number;
    billed: boolean;
    flag: string | null;
  } | null;
};

function meterRow(m: {
  id: string;
  kind: "UNIT" | "SOURCE";
  propertyId: string | null;
  serialNumber: string | null;
  initialReading: unknown;
  property: { unitNumber: string; archivedAt: Date | null } | null;
  readings: {
    period: string;
    currentReading: unknown;
    consumption: unknown;
    amount: unknown;
    invoiceId: string | null;
    flag: string | null;
  }[];
}): MeterRow {
  return {
    id: m.id,
    kind: m.kind,
    propertyId: m.propertyId,
    unitNumber: m.property?.unitNumber ?? null,
    archived: m.property?.archivedAt != null,
    serialNumber: m.serialNumber,
    initialReading: Number(m.initialReading),
    latest: m.readings[0]
      ? {
          period: m.readings[0].period,
          currentReading: Number(m.readings[0].currentReading),
          consumption: Number(m.readings[0].consumption),
          amount: Number(m.readings[0].amount),
          billed: m.readings[0].invoiceId != null,
          flag: m.readings[0].flag,
        }
      : null,
  };
}

/** Active meters + their latest reading, for the admin water page. */
export async function metersWithLatest(
  orgId: string
): Promise<{ source: MeterRow | null; units: MeterRow[] }> {
  const meters = await prisma.waterMeter.findMany({
    where: { orgId, retiredAt: null },
    include: {
      property: { select: { unitNumber: true, archivedAt: true } },
      readings: { orderBy: { period: "desc" }, take: 1 },
    },
  });
  const rows = meters.map(meterRow);
  const units = rows
    .filter((r) => r.kind === "UNIT")
    .sort((a, b) => (a.unitNumber ?? "").localeCompare(b.unitNumber ?? ""));
  const source = rows.find((r) => r.kind === "SOURCE") ?? null;
  return { source, units };
}

/**
 * Record (or update) this period's reading for a meter. Computes consumption
 * from the previous reading and the tiered amount from the org's rate bands.
 * Does NOT create an invoice — `billReadings` does that.
 */
export async function recordReading(input: {
  meterId: string;
  period: string;
  readingDate: Date;
  currentReading: number;
  priorOverride?: number | null;
  note?: string | null;
}) {
  const meter = await prisma.waterMeter.findUniqueOrThrow({
    where: { id: input.meterId },
    include: { org: true },
  });
  const cfg = waterConfig(meter.org);

  const last = await prisma.meterReading.findFirst({
    where: { meterId: meter.id, period: { lt: input.period } },
    orderBy: { period: "desc" },
    select: { currentReading: true },
  });
  const prior =
    input.priorOverride != null
      ? input.priorOverride
      : last
        ? Number(last.currentReading)
        : Number(meter.initialReading);
  const consumption = r2(Math.max(0, input.currentReading - prior));
  const flag = input.currentReading < prior ? "low" : null;

  // A SOURCE meter and every meter on an EXTERNAL_BULK org carry no tariff —
  // billing comes from `billBulk` splitting the utility bill.
  const tariffApplies =
    meter.kind === "UNIT" && meter.org.waterSource !== "EXTERNAL_BULK";
  const amount = tariffApplies
    ? computeWaterCharge(consumption, cfg.bands, cfg.serviceCharge)
    : 0;

  return prisma.meterReading.upsert({
    where: { meterId_period: { meterId: meter.id, period: input.period } },
    create: {
      meterId: meter.id,
      orgId: meter.orgId,
      period: input.period,
      readingDate: input.readingDate,
      priorReading: prior,
      currentReading: input.currentReading,
      consumption,
      amount,
      flag,
      note: input.note ?? null,
    },
    update: {
      readingDate: input.readingDate,
      priorReading: prior,
      currentReading: input.currentReading,
      consumption,
      amount,
      flag,
      note: input.note ?? null,
    },
  });
}

/** Retire a meter (it was replaced). History stays; a fresh meter takes over. */
export async function retireMeter(meterId: string) {
  return prisma.waterMeter.update({
    where: { id: meterId },
    data: { retiredAt: new Date() },
  });
}

export type ResidentWaterRow = {
  period: string;
  readingDate: Date;
  currentReading: number;
  consumption: number;
  amount: number;
  status: string | null; // linked invoice status, null = not billed
  flag: string | null;
  breakdown: string | null;
};

/** A unit's last ~12 water readings for `/portal/water`, with a per-row breakdown. */
export async function residentWaterHistory(
  propertyId: string
): Promise<{
  serialNumber: string | null;
  mode: string;
  rows: ResidentWaterRow[];
} | null> {
  const meter = await prisma.waterMeter.findFirst({
    where: { propertyId, kind: "UNIT", retiredAt: null },
    select: {
      orgId: true,
      serialNumber: true,
      org: {
        select: {
          waterSource: true,
          waterBillingEnabled: true,
          waterServiceCharge: true,
          waterRateBands: true,
        },
      },
      readings: {
        orderBy: { period: "desc" },
        take: 12,
        select: {
          period: true,
          readingDate: true,
          currentReading: true,
          consumption: true,
          amount: true,
          flag: true,
          invoice: { select: { status: true } },
        },
      },
    },
  });
  if (!meter) return null;

  const mode = meter.org.waterSource;
  const cfg = waterConfig(meter.org);
  const periods = meter.readings.map((r) => r.period);
  const runs =
    mode === "EXTERNAL_BULK" && periods.length
      ? await prisma.waterAllocationRun.findMany({
          where: { orgId: meter.orgId, period: { in: periods } },
          select: {
            period: true,
            effectiveRate: true,
            adminFeeFlat: true,
            meteredConsumption: true,
            systemLoss: true,
          },
        })
      : [];
  const runByPeriod = new Map(runs.map((r) => [r.period, r]));

  const rows: ResidentWaterRow[] = meter.readings
    .map((r) => {
      const consumption = Number(r.consumption);
      let breakdown: string | null = null;
      if (r.invoice) {
        if (mode === "INTERNAL") {
          breakdown =
            bandBreakdownText(consumption, cfg.bands, cfg.serviceCharge) || null;
        } else if (mode === "EXTERNAL_BULK") {
          const run = runByPeriod.get(r.period);
          if (run) {
            const rate = Number(run.effectiveRate);
            const fee = Number(run.adminFeeFlat);
            const metered = Number(run.meteredConsumption);
            const lossShare =
              metered > 0
                ? r2((Number(run.systemLoss) * consumption) / metered)
                : 0;
            breakdown = `${consumption.toFixed(2)} m³${
              lossShare > 0 ? ` + ${lossShare.toFixed(2)} m³ loss share` : ""
            } × ₱${rate.toFixed(2)}/m³${fee > 0 ? ` + ₱${r2(fee)} admin` : ""}`;
          }
        }
      }
      return {
        period: r.period,
        readingDate: r.readingDate,
        currentReading: Number(r.currentReading),
        consumption,
        amount: Number(r.amount),
        status: r.invoice?.status ?? null,
        flag: r.flag,
        breakdown,
      };
    })
    .reverse(); // oldest → newest

  return { serialNumber: meter.serialNumber, mode, rows };
}

/** INTERNAL invoice memo — consumption + a compact tier breakdown. */
function waterMemo(consumption: number, period: string, cfg: WaterConfig): string {
  const bd = bandBreakdownText(consumption, cfg.bands, cfg.serviceCharge);
  return `Water — ${formatConsumption(consumption)} (${periodLabel(period)})${
    bd ? ` · ${bd}` : ""
  }`;
}

/** Count + total of this period's readings that haven't been billed yet. */
export async function previewBilling(orgId: string, period: string) {
  const rows = await prisma.meterReading.findMany({
    where: { orgId, period, invoiceId: null, amount: { gt: 0 } },
    select: { amount: true },
  });
  return {
    count: rows.length,
    total: r2(rows.reduce((s, x) => s + Number(x.amount), 0)),
  };
}

/**
 * Turn this period's un-billed readings into invoices. Mirrors
 * `generateMonthlyInvoices`: a `period: null` Invoice per reading, posted to
 * 4400, resident credit auto-applied, homeowner notified.
 */
export async function billReadings(
  orgId: string,
  period: string,
  actorId: string
): Promise<{ created: number }> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
  const cfg = waterConfig(org);
  const [year, month] = period.split("-").map(Number);
  const dueDate = new Date(year, month - 1, org.billingDueDay);

  const readings = await prisma.meterReading.findMany({
    where: { orgId, period, invoiceId: null, amount: { gt: 0 } },
    include: {
      meter: {
        include: {
          property: {
            include: {
              homeowners: {
                where: { userId: { not: null } },
                select: { user: { select: recipientSelect } },
              },
            },
          },
        },
      },
    },
  });

  let created = 0;
  const notify: Recipient[] = [];

  for (const reading of readings) {
    const property = reading.meter.property;
    if (!property) continue;
    try {
      const invoice = await prisma.invoice.create({
        data: {
          propertyId: property.id,
          amount: reading.amount,
          period: null,
          dueDate,
          status: "SENT",
          memo: waterMemo(Number(reading.consumption), period, cfg),
        },
      });
      await postWaterChargeIssued(invoice.id);
      await prisma.meterReading.update({
        where: { id: reading.id },
        data: { invoiceId: invoice.id },
      });
      created++;

      const avail = Number(property.creditBalance);
      if (avail > 0.005) {
        const applied = r2(Math.min(avail, Number(invoice.amount)));
        const ca = await prisma.creditApplication.create({
          data: {
            orgId,
            propertyId: property.id,
            invoiceId: invoice.id,
            amount: applied,
            appliedById: actorId,
          },
        });
        await prisma.property.update({
          where: { id: property.id },
          data: { creditBalance: { decrement: applied } },
        });
        await postCreditApplied(ca.id);
      }

      for (const h of property.homeowners) if (h.user) notify.push(h.user);
    } catch (e: any) {
      if (e?.code !== "P2002") throw e;
    }
  }

  if (created > 0)
    await logAudit({
      action: "water.bill",
      target: periodLabel(period),
      detail: `${created} water invoice${created === 1 ? "" : "s"}`,
    });

  const unique = [...new Map(notify.map((u) => [u.id, u])).values()];
  if (unique.length)
    await deliver({
      users: unique,
      type: "DUES_ISSUED",
      title: `Water bill — ${periodLabel(period)}`,
      body: `Your water charge for ${periodLabel(period)} is posted. Due ${dueDate.toLocaleDateString(
        "en-PH",
        { day: "numeric", month: "long", year: "numeric" }
      )}.`,
      href: "/portal",
    }).catch(() => {});

  return { created };
}

/* ─────────────────── EXTERNAL_BULK: master-meter billing ──────────── */

type BulkOrg = {
  id: string;
  billingDueDay: number;
  waterSource: string;
  waterLossPolicy: "DISTRIBUTE" | "ABSORB";
  waterAdminFeeFlat: unknown;
  waterUtilityVendorId: string | null;
};

/** The allocation of a period's utility bill — for the preview / confirm panel. */
export async function previewBulk(
  orgId: string,
  period: string,
  bulkAmount: number
) {
  const org = (await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
  })) as unknown as BulkOrg;

  const readings = await prisma.meterReading.findMany({
    where: { orgId, period, invoiceId: null },
    include: {
      meter: {
        include: { property: { select: { unitNumber: true } } },
      },
    },
  });
  const sourceReading = readings.find((r) => r.meter.kind === "SOURCE") ?? null;
  const billable = readings.filter(
    (r) => r.meter.kind === "UNIT" && r.flag !== "low"
  );
  const flagged = readings.filter(
    (r) => r.meter.kind === "UNIT" && r.flag === "low"
  );

  const alloc = allocateBulk({
    bulkAmount,
    sourceConsumption: sourceReading ? Number(sourceReading.consumption) : null,
    units: billable.map((r) => ({ id: r.id, consumption: Number(r.consumption) })),
    lossPolicy: org.waterLossPolicy,
    adminFeeFlat: Number(org.waterAdminFeeFlat ?? 0),
  });

  const unitLabel = new Map(
    readings.map((r) => [r.id, r.meter.property?.unitNumber ?? "—"])
  );

  return {
    alloc,
    hasSource: sourceReading != null,
    sourceConsumption: sourceReading ? Number(sourceReading.consumption) : null,
    rows: alloc.rows.map((row) => ({
      ...row,
      unitNumber: unitLabel.get(row.unitId) ?? "—",
    })),
    flagged: flagged.map((r) => ({
      unitNumber: r.meter.property?.unitNumber ?? "—",
      currentReading: Number(r.currentReading),
      priorReading: Number(r.priorReading),
    })),
    alreadyBilled: false as boolean,
  };
}

/** Everything the EXTERNAL_BULK water page needs. */
export async function bulkWaterData(orgId: string, period: string) {
  const [{ source, units }, org, runs, unbilledForPeriod, existingRun] =
    await Promise.all([
      metersWithLatest(orgId),
      prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
      prisma.waterAllocationRun.findMany({
        where: { orgId },
        orderBy: { period: "desc" },
        take: 12,
        include: { bill: { select: { status: true } } },
      }),
      prisma.meterReading.count({
        where: { orgId, period, invoiceId: null, meter: { kind: "UNIT" } },
      }),
      prisma.waterAllocationRun.findUnique({
        where: { orgId_period: { orgId, period } },
      }),
    ]);

  const vendor = org.waterUtilityVendorId
    ? await prisma.vendor.findUnique({ where: { id: org.waterUtilityVendorId } })
    : null;

  return {
    source,
    units,
    period,
    unbilledForPeriod,
    alreadyBilled: existingRun != null,
    lossPolicy: org.waterLossPolicy as "DISTRIBUTE" | "ABSORB",
    adminFeeFlat: Number(org.waterAdminFeeFlat ?? 0),
    vendor: vendor
      ? { id: vendor.id, name: vendor.name, archived: vendor.archivedAt != null }
      : null,
    runs: runs.map((r) => ({
      id: r.id,
      period: r.period,
      bulkAmount: Number(r.bulkAmount),
      sourceConsumption: Number(r.sourceConsumption),
      meteredConsumption: Number(r.meteredConsumption),
      systemLoss: Number(r.systemLoss),
      effectiveRate: Number(r.effectiveRate),
      lossPolicy: r.lossPolicy,
      unitsBilled: r.unitsBilled,
      billStatus: r.bill?.status ?? null,
    })),
  };
}

function bulkMemo(
  consumption: number,
  period: string,
  rate: number,
  adminFeeFlat: number
): string {
  const fee = adminFeeFlat > 0 ? ` + ₱${r2(adminFeeFlat)} admin` : "";
  return `Water — ${formatConsumption(consumption)} (${periodLabel(
    period
  )}) · ₱${rate.toFixed(2)}/m³${fee}`;
}

type BillBulkResult =
  | { ok: true; created: number; billId: string; residentTotal: number }
  | { ok: false; error: string };

/**
 * Bill an EXTERNAL_BULK period: book the utility bill (5150), split it across the
 * un-billed unit readings (4400), and snapshot the run.
 */
export async function billBulk(input: {
  orgId: string;
  period: string;
  bulkAmount: number;
  billDate: Date;
  actorId: string;
}): Promise<BillBulkResult> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.orgId },
  });
  if (org.waterSource !== "EXTERNAL_BULK")
    return { ok: false, error: "This HOA isn't on bulk water billing." };
  if (!(input.bulkAmount > 0))
    return { ok: false, error: "Enter the utility bill amount." };
  if (!org.waterUtilityVendorId)
    return { ok: false, error: "Choose a water utility vendor in Settings first." };

  const vendor = await prisma.vendor.findFirst({
    where: { id: org.waterUtilityVendorId, orgId: org.id },
  });
  if (!vendor || vendor.archivedAt)
    return {
      ok: false,
      error: "The water utility vendor is missing or archived — pick another in Settings.",
    };

  const existing = await prisma.waterAllocationRun.findUnique({
    where: { orgId_period: { orgId: org.id, period: input.period } },
  });
  if (existing)
    return { ok: false, error: `${periodLabel(input.period)} has already been billed.` };

  const readings = await prisma.meterReading.findMany({
    where: { orgId: org.id, period: input.period, invoiceId: null },
    include: {
      meter: {
        include: {
          property: {
            include: {
              homeowners: {
                where: { userId: { not: null } },
                select: { user: { select: recipientSelect } },
              },
            },
          },
        },
      },
    },
  });
  const sourceReading = readings.find((r) => r.meter.kind === "SOURCE") ?? null;
  const unitReadings = readings.filter(
    (r) => r.meter.kind === "UNIT" && r.flag !== "low" && r.meter.property
  );

  const adminFeeFlat = Number(org.waterAdminFeeFlat ?? 0);
  const alloc = allocateBulk({
    bulkAmount: input.bulkAmount,
    sourceConsumption: sourceReading ? Number(sourceReading.consumption) : null,
    units: unitReadings.map((r) => ({
      id: r.id,
      consumption: Number(r.consumption),
    })),
    lossPolicy: org.waterLossPolicy,
    adminFeeFlat,
  });
  if (alloc.error) return { ok: false, error: alloc.error };

  const [year, month] = input.period.split("-").map(Number);
  const dueDate = new Date(year, month - 1, org.billingDueDay);

  const bill = await prisma.bill.create({
    data: {
      orgId: org.id,
      vendorId: vendor.id,
      description: `Water — ${periodLabel(input.period)}`,
      amount: r2(input.bulkAmount),
      billDate: input.billDate,
      dueDate,
      expenseAccountCode: "5150",
      createdById: input.actorId,
    },
  });
  await postBillIssued(bill.id);

  const rowByReading = new Map(alloc.rows.map((r) => [r.unitId, r]));
  let created = 0;
  const notify: Recipient[] = [];

  for (const reading of unitReadings) {
    const row = rowByReading.get(reading.id);
    if (!row) continue;
    const property = reading.meter.property!;
    try {
      const invoice = await prisma.invoice.create({
        data: {
          propertyId: property.id,
          amount: row.amount,
          period: null,
          dueDate,
          status: "SENT",
          memo: bulkMemo(
            Number(reading.consumption),
            input.period,
            alloc.effectiveRate,
            adminFeeFlat
          ),
        },
      });
      await postWaterChargeIssued(invoice.id);
      await prisma.meterReading.update({
        where: { id: reading.id },
        data: { invoiceId: invoice.id, amount: row.amount },
      });
      created++;

      const avail = Number(property.creditBalance);
      if (avail > 0.005) {
        const applied = r2(Math.min(avail, Number(invoice.amount)));
        const ca = await prisma.creditApplication.create({
          data: {
            orgId: org.id,
            propertyId: property.id,
            invoiceId: invoice.id,
            amount: applied,
            appliedById: input.actorId,
          },
        });
        await prisma.property.update({
          where: { id: property.id },
          data: { creditBalance: { decrement: applied } },
        });
        await postCreditApplied(ca.id);
      }

      for (const h of property.homeowners) if (h.user) notify.push(h.user);
    } catch (e: any) {
      if (e?.code !== "P2002") throw e;
    }
  }

  await prisma.waterAllocationRun.create({
    data: {
      orgId: org.id,
      period: input.period,
      billId: bill.id,
      bulkAmount: r2(input.bulkAmount),
      sourceConsumption: alloc.sourceConsumption,
      meteredConsumption: alloc.meteredConsumption,
      commonConsumption: alloc.commonConsumption,
      systemLoss: alloc.systemLoss,
      effectiveRate: alloc.effectiveRate,
      lossPolicy: org.waterLossPolicy,
      adminFeeFlat,
      unitsBilled: created,
      createdById: input.actorId,
    },
  });

  await logAudit({
    action: "water.bill_bulk",
    target: periodLabel(input.period),
    detail: `${created} unit${created === 1 ? "" : "s"} · ₱${r2(
      input.bulkAmount
    )} bulk`,
  });

  const unique = [...new Map(notify.map((u) => [u.id, u])).values()];
  if (unique.length)
    await deliver({
      users: unique,
      type: "DUES_ISSUED",
      title: `Water bill — ${periodLabel(input.period)}`,
      body: `Your water charge for ${periodLabel(
        input.period
      )} is posted. Due ${dueDate.toLocaleDateString("en-PH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}.`,
      href: "/portal",
    }).catch(() => {});

  return { ok: true, created, billId: bill.id, residentTotal: alloc.residentTotal };
}
