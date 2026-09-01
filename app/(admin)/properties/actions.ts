"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import type { ValidRow } from "@/lib/csv";

const schema = z.object({
  unitNumber: z.string().trim().min(1, "Unit number is required"),
  type: z.enum(["RESIDENTIAL", "COMMERCIAL", "TOWNHOUSE"]),
  monthlyRate: z.coerce.number().nonnegative("Rate must be 0 or more"),
  ratePlanId: z.string().uuid().optional().or(z.literal("")),
  homeownerName: z.string().trim().optional(),
  homeownerEmail: z
    .string()
    .trim()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
});

export type AddPropertyResult =
  | { ok: true }
  | { ok: false; error: string };

export async function addProperty(input: unknown): Promise<AddPropertyResult> {
  const denied = await denyUnless("property:write");
  if (denied) return denied;

  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const d = parsed.data;

  const dupe = await prisma.property.findUnique({
    where: { orgId_unitNumber: { orgId: org.id, unitNumber: d.unitNumber } },
  });
  if (dupe) return { ok: false, error: "That unit number already exists" };

  let monthlyRate = d.monthlyRate;
  let ratePlanId: string | null = null;
  if (d.ratePlanId) {
    const plan = await prisma.ratePlan.findFirst({
      where: { id: d.ratePlanId, orgId: org.id },
    });
    if (!plan) return { ok: false, error: "Rate plan not found" };
    monthlyRate = Number(plan.monthlyRate);
    ratePlanId = plan.id;
  }

  await prisma.property.create({
    data: {
      orgId: org.id,
      unitNumber: d.unitNumber,
      type: d.type,
      monthlyRate,
      ratePlanId,
      homeowners: d.homeownerName
        ? {
            create: {
              fullName: d.homeownerName,
              email: d.homeownerEmail || null,
              isPrimary: true,
            },
          }
        : undefined,
    },
  });

  revalidatePath("/properties");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ─────────────────────────── CSV import ──────────────────────────── */

const importRowSchema = z.object({
  unitNumber: z.string().trim().min(1),
  type: z.enum(["RESIDENTIAL", "COMMERCIAL", "TOWNHOUSE"]),
  monthlyRate: z.number().nonnegative(),
  homeownerName: z.string().trim().optional(),
  homeownerEmail: z.string().trim().optional(),
  homeownerPhone: z.string().trim().optional(),
});

export type ImportResult =
  | { ok: true; imported: number; skipped: number }
  | { ok: false; error: string };

export async function importProperties(rows: ValidRow[]): Promise<ImportResult> {
  const denied = await denyUnless("property:write");
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const parsed = z.array(importRowSchema).max(5000).safeParse(rows);
  if (!parsed.success) return { ok: false, error: "Invalid property data" };

  let imported = 0;
  for (const r of parsed.data) {
    try {
      await prisma.property.create({
        data: {
          orgId: org.id,
          unitNumber: r.unitNumber,
          type: r.type,
          monthlyRate: r.monthlyRate,
          homeowners: r.homeownerName
            ? {
                create: {
                  fullName: r.homeownerName,
                  email: r.homeownerEmail || null,
                  phone: r.homeownerPhone || null,
                  isPrimary: true,
                },
              }
            : undefined,
        },
      });
      imported++;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        continue; // unit already exists — skip
      throw e;
    }
  }

  revalidatePath("/properties");
  revalidatePath("/dashboard");
  return { ok: true, imported, skipped: parsed.data.length - imported };
}
