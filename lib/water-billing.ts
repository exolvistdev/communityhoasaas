import { prisma } from "@/lib/prisma";
import { periodLabel } from "@/lib/format";
import { postWaterChargeIssued, postCreditApplied } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";
import { deliver, recipientSelect, type Recipient } from "@/lib/notifications";
import {
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

/** Meters + their latest reading, for the admin water page. */
export async function metersWithLatest(orgId: string) {
  const meters = await prisma.waterMeter.findMany({
    where: { orgId },
    include: {
      property: { select: { unitNumber: true, archivedAt: true } },
      readings: { orderBy: { period: "desc" }, take: 1 },
    },
    orderBy: { property: { unitNumber: "asc" } },
  });
  return meters.map((m) => ({
    id: m.id,
    propertyId: m.propertyId,
    unitNumber: m.property.unitNumber,
    archived: m.property.archivedAt != null,
    serialNumber: m.serialNumber,
    latest: m.readings[0]
      ? {
          period: m.readings[0].period,
          currentReading: Number(m.readings[0].currentReading),
          consumption: Number(m.readings[0].consumption),
          amount: Number(m.readings[0].amount),
          billed: m.readings[0].invoiceId != null,
        }
      : null,
  }));
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
      : Number(last?.currentReading ?? 0);
  const consumption = r2(Math.max(0, input.currentReading - prior));
  const amount = computeWaterCharge(consumption, cfg.bands, cfg.serviceCharge);

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
      note: input.note ?? null,
    },
    update: {
      readingDate: input.readingDate,
      priorReading: prior,
      currentReading: input.currentReading,
      consumption,
      amount,
      note: input.note ?? null,
    },
  });
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
    try {
      const invoice = await prisma.invoice.create({
        data: {
          propertyId: property.id,
          amount: reading.amount,
          period: null,
          dueDate,
          status: "SENT",
          memo: `Water — ${formatConsumption(Number(reading.consumption))} (${periodLabel(period)})`,
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
