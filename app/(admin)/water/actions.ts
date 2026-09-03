"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  recordReading,
  billReadings,
  billBulk,
  previewBulk,
  retireMeter,
} from "@/lib/water-billing";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const PERIOD = /^\d{4}-\d{2}$/;

async function guard() {
  return denyUnless("billing:write");
}

function revalidate() {
  revalidatePath("/water");
  revalidatePath("/dashboard");
}

/* ─────────────────────────── meters ────────────────────────────── */

const meterSchema = z.object({
  propertyId: z.string().min(1),
  serialNumber: z.string().trim().max(80).optional().or(z.literal("")),
  initialReading: z.coerce.number().nonnegative().max(9_999_999).optional(),
});

export async function addMeter(input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = meterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const property = await prisma.property.findFirst({
    where: { id: parsed.data.propertyId, orgId: org.id },
    select: { id: true, unitNumber: true },
  });
  if (!property) return { ok: false, error: "Unit not found" };

  const existing = await prisma.waterMeter.findFirst({
    where: { propertyId: property.id, retiredAt: null },
  });
  if (existing) return { ok: false, error: "That unit already has a meter" };

  await prisma.waterMeter.create({
    data: {
      orgId: org.id,
      propertyId: property.id,
      serialNumber: parsed.data.serialNumber || null,
      initialReading: parsed.data.initialReading ?? 0,
      installedAt: new Date(),
    },
  });
  await logAudit({ action: "meter.create", target: property.unitNumber });
  revalidate();
  return { ok: true };
}

const replaceSchema = z.object({
  meterId: z.string().min(1),
  serialNumber: z.string().trim().max(80).optional().or(z.literal("")),
  initialReading: z.coerce.number().nonnegative().max(9_999_999),
});

/** Retire a meter and install a fresh one on the same unit, starting at the
 *  new meter's installed number. */
export async function replaceMeter(input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = replaceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const meter = await prisma.waterMeter.findFirst({
    where: { id: parsed.data.meterId, orgId: org.id, retiredAt: null },
    include: { property: { select: { id: true, unitNumber: true } } },
  });
  if (!meter || !meter.property)
    return { ok: false, error: "Meter not found" };

  await prisma.$transaction(async (tx) => {
    await tx.waterMeter.update({
      where: { id: meter.id },
      data: { retiredAt: new Date() },
    });
    await tx.waterMeter.create({
      data: {
        orgId: org.id,
        propertyId: meter.property!.id,
        kind: meter.kind,
        serialNumber: parsed.data.serialNumber || null,
        initialReading: parsed.data.initialReading,
        installedAt: new Date(),
      },
    });
  });
  await logAudit({
    action: "meter.replace",
    target: meter.property.unitNumber,
    detail: `new baseline ${parsed.data.initialReading}`,
  });
  revalidate();
  return { ok: true };
}

const sourceMeterSchema = z.object({
  serialNumber: z.string().trim().max(80).optional().or(z.literal("")),
  initialReading: z.coerce.number().nonnegative().max(99_999_999).optional(),
});

/** Add the utility master meter (EXTERNAL_BULK). One active per org. */
export async function addSourceMeter(input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = sourceMeterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  if (org.waterSource !== "EXTERNAL_BULK")
    return { ok: false, error: "Only bulk-water HOAs have a master meter." };

  const existing = await prisma.waterMeter.findFirst({
    where: { orgId: org.id, kind: "SOURCE", retiredAt: null },
  });
  if (existing) return { ok: false, error: "A master meter already exists." };

  await prisma.waterMeter.create({
    data: {
      orgId: org.id,
      kind: "SOURCE",
      serialNumber: parsed.data.serialNumber || null,
      initialReading: parsed.data.initialReading ?? 0,
      installedAt: new Date(),
    },
  });
  await logAudit({ action: "meter.create", target: "master meter" });
  revalidate();
  return { ok: true };
}

export async function removeMeter(meterId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const meter = await prisma.waterMeter.findFirst({
    where: { id: meterId, orgId: org.id },
    include: {
      property: { select: { unitNumber: true } },
      _count: { select: { readings: true } },
    },
  });
  if (!meter) return { ok: false, error: "Meter not found" };
  if (meter._count.readings > 0)
    return {
      ok: false,
      error: "This meter has readings on record — retire it instead of deleting.",
    };

  await prisma.waterMeter.delete({ where: { id: meterId } });
  await logAudit({
    action: "meter.remove",
    target: meter.property?.unitNumber ?? "master meter",
  });
  revalidate();
  return { ok: true };
}

/* ─────────────────────────── readings ──────────────────────────── */

const readingRow = z.object({
  meterId: z.string().min(1),
  currentReading: z.coerce.number().nonnegative(),
});

const readingsSchema = z.object({
  period: z.string().regex(PERIOD),
  rows: z.array(readingRow),
});

export async function saveReadings(input: unknown): Promise<Result<{ saved: number }>> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = readingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const meters = await prisma.waterMeter.findMany({
    where: { orgId: org.id },
    select: { id: true },
  });
  const owned = new Set(meters.map((m) => m.id));
  const readingDate = new Date();

  let saved = 0;
  for (const row of parsed.data.rows) {
    if (!owned.has(row.meterId)) continue;
    await recordReading({
      meterId: row.meterId,
      period: parsed.data.period,
      readingDate,
      currentReading: row.currentReading,
    });
    saved++;
  }

  if (saved > 0)
    await logAudit({
      action: "water.reading",
      detail: `${saved} reading${saved === 1 ? "" : "s"} for ${parsed.data.period}`,
    });
  revalidate();
  return { ok: true, saved };
}

export async function billPeriod(period: string): Promise<Result<{ created: number }>> {
  const denied = await guard();
  if (denied) return denied;
  if (!PERIOD.test(period)) return { ok: false, error: "Invalid period" };

  const { org, user } = await getCurrentOrgContext();
  const res = await billReadings(org.id, period, user.id);
  revalidatePath("/water");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  return { ok: true, created: res.created };
}

export async function retireMeterAction(meterId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const { org } = await getCurrentOrgContext();
  const meter = await prisma.waterMeter.findFirst({
    where: { id: meterId, orgId: org.id, retiredAt: null },
    include: { property: { select: { unitNumber: true } } },
  });
  if (!meter) return { ok: false, error: "Meter not found" };
  await retireMeter(meterId);
  await logAudit({
    action: "meter.retire",
    target: meter.property?.unitNumber ?? "master meter",
  });
  revalidate();
  return { ok: true };
}

const bulkSchema = z.object({
  period: z.string().regex(PERIOD),
  bulkAmount: z.coerce.number().positive("Enter the utility bill amount"),
  billDate: z.string().min(1),
});

const previewSchema = z.object({
  period: z.string().regex(PERIOD),
  bulkAmount: z.coerce.number().nonnegative(),
});

export async function previewBulkAction(input: unknown) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const { org } = await getCurrentOrgContext();
  const preview = await previewBulk(org.id, parsed.data.period, parsed.data.bulkAmount);
  return { ok: true as const, preview };
}

export async function billBulkPeriod(
  input: unknown
): Promise<Result<{ created: number; residentTotal: number }>> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const billDate = new Date(`${parsed.data.billDate}T12:00:00+08:00`);
  if (Number.isNaN(billDate.getTime()))
    return { ok: false, error: "Invalid bill date" };

  const res = await billBulk({
    orgId: org.id,
    period: parsed.data.period,
    bulkAmount: parsed.data.bulkAmount,
    billDate,
    actorId: user.id,
  });
  if (!res.ok) return res;

  revalidatePath("/water");
  revalidatePath("/billing");
  revalidatePath("/bills");
  revalidatePath("/dashboard");
  return { ok: true, created: res.created, residentTotal: res.residentTotal };
}
