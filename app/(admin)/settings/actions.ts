"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { uploadPaymentQr, deletePaymentQr } from "@/lib/payment-qr";
import { validateBands, type RateBand } from "@/lib/water";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

type Denial = { ok: false; error: string } | null;

async function guard(): Promise<Denial> {
  return denyUnless("settings:write");
}

// Rate plans are billing configuration — treasurers manage them too.
async function guardRatePlan(): Promise<Denial> {
  return denyUnless("billing:write");
}

function revalidateAll() {
  revalidatePath("/settings");
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/billing");
}

/* ─────────────────────── organization settings ───────────────────── */

const orgSchema = z.object({
  name: z.string().trim().min(2, "Enter your HOA's name"),
  billingDueDay: z.coerce
    .number()
    .int("Enter a whole number")
    .min(1, "Day must be 1–28")
    .max(28, "Use 1–28 so every month has that day"),
  privacyContactEmail: z
    .string()
    .trim()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
});

export async function updateOrgSettings(input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = orgSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      name: parsed.data.name,
      billingDueDay: parsed.data.billingDueDay,
      privacyContactEmail: parsed.data.privacyContactEmail || null,
    },
  });

  revalidateAll();
  await logAudit({ action: "settings.update", detail: parsed.data.name });
  return { ok: true };
}

const str = () =>
  z.string().trim().max(500).optional().or(z.literal(""));

const paymentSchema = z.object({
  gcashNumber: str(),
  gcashName: str(),
  mayaNumber: str(),
  mayaName: str(),
  paymentInstructions: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function updatePaymentSettings(input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const d = parsed.data;
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      gcashNumber: d.gcashNumber || null,
      gcashName: d.gcashName || null,
      mayaNumber: d.mayaNumber || null,
      mayaName: d.mayaName || null,
      paymentInstructions: d.paymentInstructions || null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/portal");
  await logAudit({ action: "settings.payments_update" });
  return { ok: true };
}

/* ─────────────────────── payment QR images ───────────────────────── */

export async function setPaymentQr(formData: FormData): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const wallet = formData.get("wallet");
  const file = formData.get("file");
  if (wallet !== "gcash" && wallet !== "maya")
    return { ok: false, error: "Unknown wallet" };
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose an image file" };

  const { org } = await getCurrentOrgContext();
  const path = await uploadPaymentQr(file, { orgId: org.id, wallet });
  if (!path)
    return {
      ok: false,
      error: "That file isn't a supported image (PNG, JPG or WebP, up to 2 MB)",
    };

  const field = wallet === "gcash" ? "gcashQrPath" : "mayaQrPath";
  const prev = wallet === "gcash" ? org.gcashQrPath : org.mayaQrPath;
  await prisma.organization.update({
    where: { id: org.id },
    data: { [field]: path },
  });
  if (prev) await deletePaymentQr(prev);

  revalidatePath("/settings");
  revalidatePath("/portal");
  revalidatePath("/portal/pay");
  await logAudit({ action: "settings.payments_update", detail: `${wallet} QR` });
  return { ok: true };
}

export async function removePaymentQr(
  wallet: "gcash" | "maya"
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const field = wallet === "gcash" ? "gcashQrPath" : "mayaQrPath";
  const prev = wallet === "gcash" ? org.gcashQrPath : org.mayaQrPath;
  await prisma.organization.update({
    where: { id: org.id },
    data: { [field]: null },
  });
  if (prev) await deletePaymentQr(prev);

  revalidatePath("/settings");
  revalidatePath("/portal");
  revalidatePath("/portal/pay");
  await logAudit({ action: "settings.payments_update", detail: `${wallet} QR removed` });
  return { ok: true };
}

/* ───────────────────────────── late fees ─────────────────────────── */

const lateFeeSchema = z.object({
  lateFeeEnabled: z.preprocess(
    (v) => v === true || v === "true" || v === "on",
    z.boolean()
  ),
  lateFeeType: z.enum(["FIXED", "PERCENT"]),
  lateFeeAmount: z.coerce.number().min(0, "Enter 0 or more").max(1_000_000),
  lateFeeGraceDays: z.coerce
    .number()
    .int("Whole days only")
    .min(0)
    .max(90, "Keep the grace period under 90 days"),
  lateFeeMaxOccurrences: z.coerce
    .number()
    .int("Whole number")
    .min(1)
    .max(12, "12 at most"),
});

export async function updateLateFeeSettings(input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = lateFeeSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  if (d.lateFeeType === "PERCENT" && d.lateFeeAmount > 100)
    return { ok: false, error: "A percentage late fee can't exceed 100%" };

  const { org } = await getCurrentOrgContext();
  await prisma.organization.update({ where: { id: org.id }, data: d });

  revalidatePath("/settings");
  await logAudit({
    action: "settings.late_fees_update",
    detail: d.lateFeeEnabled ? "enabled" : "disabled",
  });
  return { ok: true };
}

/* ─────────────────── default rates by property type ──────────────── */

const optionalRate = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().nonnegative("Rate must be 0 or more").max(10_000_000).optional()
);

const typeRatesSchema = z.object({
  typeRateResidential: optionalRate,
  typeRateCommercial: optionalRate,
  typeRateTownhouse: optionalRate,
});

export async function updateTypeRates(input: unknown): Promise<Result> {
  const denied = await guardRatePlan();
  if (denied) return denied;

  const parsed = typeRatesSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const d = parsed.data;
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      typeRateResidential: d.typeRateResidential ?? null,
      typeRateCommercial: d.typeRateCommercial ?? null,
      typeRateTownhouse: d.typeRateTownhouse ?? null,
    },
  });

  revalidateAll();
  await logAudit({ action: "settings.type_rates_update" });
  return { ok: true };
}

const TYPE_FIELD = {
  RESIDENTIAL: "typeRateResidential",
  COMMERCIAL: "typeRateCommercial",
  TOWNHOUSE: "typeRateTownhouse",
} as const;

/** Set monthlyRate to the type default for every non-plan, non-archived
 *  property of that type. */
export async function reapplyTypeRate(
  type: "RESIDENTIAL" | "COMMERCIAL" | "TOWNHOUSE"
): Promise<Result<{ updated: number }>> {
  const denied = await guardRatePlan();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const rate = org[TYPE_FIELD[type]];
  if (rate == null)
    return { ok: false, error: "Set a default for this type first" };

  const res = await prisma.property.updateMany({
    where: { orgId: org.id, type, ratePlanId: null, archivedAt: null },
    data: { monthlyRate: rate },
  });

  revalidateAll();
  if (res.count > 0)
    await logAudit({
      action: "settings.type_rates_reapply",
      target: type.toLowerCase(),
      detail: `${res.count} propert${res.count === 1 ? "y" : "ies"}`,
    });
  return { ok: true, updated: res.count };
}

/* ───────────────────────────── water source ──────────────────────── */

const waterSourceSchema = z.object({
  waterSource: z.enum(["INTERNAL", "EXTERNAL_BULK", "EXTERNAL_DIRECT"]),
});

export async function updateWaterSource(input: unknown): Promise<Result> {
  const denied = await guardRatePlan();
  if (denied) return denied;

  const parsed = waterSourceSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const next = parsed.data.waterSource;

  if (next === "EXTERNAL_DIRECT") {
    const meters = await prisma.waterMeter.count({ where: { orgId: org.id } });
    if (meters > 0)
      return {
        ok: false,
        error:
          "Remove the water meters first — homes on direct utility accounts aren't metered here.",
      };
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      waterSource: next,
      // leaving the metered modes turns billing off
      waterBillingEnabled:
        next === "EXTERNAL_DIRECT" ? false : org.waterBillingEnabled,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/water");
  revalidatePath("/dashboard");
  await logAudit({ action: "water.source_update", detail: next });
  return { ok: true };
}

/* ───────────────────────────── water billing ─────────────────────── */

const bandSchema = z.object({
  upToM3: z.union([z.coerce.number().positive(), z.null()]),
  pricePerM3: z.coerce.number().positive(),
});

const waterSchema = z.object({
  waterBillingEnabled: z.preprocess(
    (v) => v === true || v === "true" || v === "on",
    z.boolean()
  ),
  waterServiceCharge: z.coerce.number().min(0).max(1_000_000),
  waterRateBands: z.array(bandSchema),
});

export async function updateWaterConfig(input: unknown): Promise<Result> {
  const denied = await guardRatePlan();
  if (denied) return denied;

  const parsed = waterSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  if (d.waterBillingEnabled) {
    const problems = validateBands(d.waterRateBands as RateBand[]);
    if (problems.length) return { ok: false, error: problems[0] };
  }

  const { org } = await getCurrentOrgContext();
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      waterBillingEnabled: d.waterBillingEnabled,
      waterServiceCharge: d.waterServiceCharge,
      waterRateBands: d.waterRateBands as unknown as object,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/water");
  await logAudit({
    action: "settings.water_update",
    detail: d.waterBillingEnabled ? "enabled" : "disabled",
  });
  return { ok: true };
}

/* ─────────────────── water billing — EXTERNAL_BULK ───────────────── */

const bulkWaterSchema = z.object({
  waterBillingEnabled: z.preprocess(
    (v) => v === true || v === "true" || v === "on",
    z.boolean()
  ),
  waterUtilityVendorId: z.string().trim().optional().or(z.literal("")),
  newVendorName: z.string().trim().max(120).optional().or(z.literal("")),
  waterLossPolicy: z.enum(["DISTRIBUTE", "ABSORB"]),
  waterAdminFeeFlat: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().nonnegative("Fee must be 0 or more").max(100_000).optional()
  ),
});

export async function updateWaterBulkConfig(input: unknown): Promise<Result> {
  const denied = await guardRatePlan();
  if (denied) return denied;

  const parsed = bulkWaterSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const { org } = await getCurrentOrgContext();
  if (org.waterSource !== "EXTERNAL_BULK")
    return { ok: false, error: "This HOA isn't on bulk water billing." };

  let vendorId = d.waterUtilityVendorId || null;
  if (d.newVendorName) {
    const vendor = await prisma.vendor.create({
      data: { orgId: org.id, name: d.newVendorName },
    });
    vendorId = vendor.id;
    await logAudit({ action: "vendor.create", target: vendor.name });
  } else if (vendorId) {
    const exists = await prisma.vendor.findFirst({
      where: { id: vendorId, orgId: org.id },
    });
    if (!exists) return { ok: false, error: "Vendor not found" };
  }

  if (d.waterBillingEnabled && !vendorId)
    return { ok: false, error: "Choose or add a water utility vendor first." };

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      waterBillingEnabled: d.waterBillingEnabled,
      waterUtilityVendorId: vendorId,
      waterLossPolicy: d.waterLossPolicy,
      waterAdminFeeFlat: d.waterAdminFeeFlat ?? null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/water");
  await logAudit({
    action: "settings.water_update",
    detail: `bulk · ${d.waterBillingEnabled ? "enabled" : "disabled"}`,
  });
  return { ok: true };
}

/* ───────────────────────────── rate plans ────────────────────────── */

const planSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  monthlyRate: z.coerce.number().nonnegative("Rate must be 0 or more"),
});

export type RatePlanDTO = { id: string; name: string; monthlyRate: number };

export async function createRatePlan(
  input: unknown
): Promise<Result<{ plan: RatePlanDTO }>> {
  const denied = await guardRatePlan();
  if (denied) return denied;
  const parsed = planSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();

  const dupe = await prisma.ratePlan.findUnique({
    where: { orgId_name: { orgId: org.id, name: parsed.data.name } },
  });
  if (dupe) return { ok: false, error: "A plan with that name already exists" };

  const plan = await prisma.ratePlan.create({
    data: {
      orgId: org.id,
      name: parsed.data.name,
      monthlyRate: parsed.data.monthlyRate,
    },
  });

  revalidateAll();
  await logAudit({ action: "rateplan.create", target: plan.name });
  return {
    ok: true,
    plan: { id: plan.id, name: plan.name, monthlyRate: Number(plan.monthlyRate) },
  };
}

export async function updateRatePlan(
  id: string,
  input: unknown
): Promise<Result> {
  const denied = await guardRatePlan();
  if (denied) return denied;
  const parsed = planSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const plan = await prisma.ratePlan.findFirst({ where: { id, orgId: org.id } });
  if (!plan) return { ok: false, error: "Rate plan not found" };

  if (parsed.data.name !== plan.name) {
    const dupe = await prisma.ratePlan.findUnique({
      where: { orgId_name: { orgId: org.id, name: parsed.data.name } },
    });
    if (dupe) return { ok: false, error: "A plan with that name already exists" };
  }

  // Changing the plan's rate does NOT retroactively change property rates —
  // that's an explicit "re-apply" so past billing isn't silently rewritten.
  await prisma.ratePlan.update({
    where: { id },
    data: { name: parsed.data.name, monthlyRate: parsed.data.monthlyRate },
  });

  revalidateAll();
  await logAudit({
    action: "rateplan.update",
    target: parsed.data.name,
    detail: `₱${plan.monthlyRate} → ₱${parsed.data.monthlyRate}`,
  });
  return { ok: true };
}

/** Set monthlyRate = plan.monthlyRate for every property on this plan. */
export async function reapplyRatePlan(
  id: string
): Promise<Result<{ updated: number }>> {
  const denied = await guardRatePlan();
  if (denied) return denied;
  const { org } = await getCurrentOrgContext();
  const plan = await prisma.ratePlan.findFirst({ where: { id, orgId: org.id } });
  if (!plan) return { ok: false, error: "Rate plan not found" };

  const res = await prisma.property.updateMany({
    where: { orgId: org.id, ratePlanId: id },
    data: { monthlyRate: plan.monthlyRate },
  });

  revalidateAll();
  if (res.count > 0)
    await logAudit({
      action: "rateplan.reapply",
      target: plan.name,
      detail: `${res.count} propert${res.count === 1 ? "y" : "ies"}`,
    });
  return { ok: true, updated: res.count };
}

/** Delete a plan; any properties on it fall back to a custom rate (keeping
 *  their current monthlyRate). */
export async function deleteRatePlan(
  id: string
): Promise<Result<{ detached: number }>> {
  const denied = await guardRatePlan();
  if (denied) return denied;
  const { org } = await getCurrentOrgContext();
  const plan = await prisma.ratePlan.findFirst({ where: { id, orgId: org.id } });
  if (!plan) return { ok: false, error: "Rate plan not found" };

  const detached = await prisma.$transaction(async (tx) => {
    const res = await tx.property.updateMany({
      where: { orgId: org.id, ratePlanId: id },
      data: { ratePlanId: null },
    });
    await tx.ratePlan.delete({ where: { id } });
    return res.count;
  });

  revalidateAll();
  await logAudit({
    action: "rateplan.delete",
    target: plan.name,
    detail: detached > 0 ? `${detached} propert${detached === 1 ? "y" : "ies"} detached` : undefined,
  });
  return { ok: true, detached };
}
