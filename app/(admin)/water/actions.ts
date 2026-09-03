"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { recordReading, billReadings } from "@/lib/water-billing";

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

  const existing = await prisma.waterMeter.findUnique({
    where: { propertyId: property.id },
  });
  if (existing) return { ok: false, error: "That unit already has a meter" };

  await prisma.waterMeter.create({
    data: {
      orgId: org.id,
      propertyId: property.id,
      serialNumber: parsed.data.serialNumber || null,
      installedAt: new Date(),
    },
  });
  await logAudit({ action: "meter.create", target: property.unitNumber });
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
  await logAudit({ action: "meter.remove", target: meter.property.unitNumber });
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
