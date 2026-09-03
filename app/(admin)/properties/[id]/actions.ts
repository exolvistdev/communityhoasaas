"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { generateInviteLink } from "@/lib/invites";
import { logAudit } from "@/lib/audit";
import { typeDefaultRate, toTypeRateDefaults } from "@/lib/rate";
import { postRefund } from "@/lib/ledger";
import { deliver, recipientSelect, type Recipient } from "@/lib/notifications";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function revalidateProperty(id: string) {
  revalidatePath(`/properties/${id}`);
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
}

async function guard(): Promise<{ ok: false; error: string } | null> {
  return denyUnless("property:write");
}

/* ─────────────────────────── archive ─────────────────────────────── */

export async function setPropertyArchived(
  id: string,
  archived: boolean
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const property = await prisma.property.findFirst({
    where: { id, orgId: org.id },
  });
  if (!property) return { ok: false, error: "Property not found" };

  await prisma.property.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });

  revalidateProperty(id);
  await logAudit({
    action: archived ? "property.archive" : "property.restore",
    target: property.unitNumber,
  });
  return { ok: true };
}

/* ───────────────────────────── property ──────────────────────────── */

const updateSchema = z
  .object({
    unitNumber: z.string().trim().min(1, "Unit number is required"),
    type: z.enum(["RESIDENTIAL", "COMMERCIAL", "TOWNHOUSE"]),
    ratePlanId: z.string().uuid().optional(),
    customRate: z.coerce.number().nonnegative("Rate must be 0 or more").optional(),
    useTypeDefault: z.boolean().optional(),
  })
  .refine(
    (d) => d.ratePlanId || d.customRate !== undefined || d.useTypeDefault,
    { message: "Choose a rate plan, enter a rate, or use the type default" }
  );

export async function updateProperty(
  id: string,
  input: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const d = parsed.data;

  const property = await prisma.property.findFirst({
    where: { id, orgId: org.id },
  });
  if (!property) return { ok: false, error: "Property not found" };

  if (d.unitNumber !== property.unitNumber) {
    const dupe = await prisma.property.findUnique({
      where: { orgId_unitNumber: { orgId: org.id, unitNumber: d.unitNumber } },
    });
    if (dupe) return { ok: false, error: "That unit number already exists" };
  }

  let monthlyRate: number;
  let ratePlanId: string | null;

  if (d.ratePlanId) {
    const plan = await prisma.ratePlan.findFirst({
      where: { id: d.ratePlanId, orgId: org.id },
    });
    if (!plan) return { ok: false, error: "Rate plan not found" };
    monthlyRate = Number(plan.monthlyRate);
    ratePlanId = plan.id;
  } else if (d.customRate !== undefined) {
    monthlyRate = d.customRate;
    ratePlanId = null;
  } else {
    const fallback = typeDefaultRate(toTypeRateDefaults(org), d.type);
    if (fallback === null)
      return {
        ok: false,
        error: `No ${d.type.toLowerCase()} default is set. Add one in Settings, or enter a rate.`,
      };
    monthlyRate = fallback;
    ratePlanId = null;
  }

  await prisma.property.update({
    where: { id },
    data: { unitNumber: d.unitNumber, type: d.type, monthlyRate, ratePlanId },
  });

  revalidateProperty(id);
  return { ok: true };
}

/* ───────────────────────────── refunds ───────────────────────────── */

const refundSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  method: z.enum(["CASH", "CHECK", "BANK_TRANSFER", "GCASH", "MAYA"]),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  reason: z.string().trim().min(3, "Give a reason").max(500),
});

/** Pay a resident's carried credit back in cash (DR 2100 / CR 1000). */
export async function issueRefund(
  propertyId: string,
  input: unknown
): Promise<Result> {
  const denied = await denyUnless("billing:write"); // it moves money — treasurer/admin
  if (denied) return denied;

  const parsed = refundSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId: org.id },
    include: {
      homeowners: {
        where: { userId: { not: null } },
        select: { user: { select: recipientSelect } },
      },
    },
  });
  if (!property) return { ok: false, error: "Property not found" };

  const d = parsed.data;
  const amount = Math.round(d.amount * 100) / 100;
  const available = Number(property.creditBalance);
  if (amount > available + 0.005)
    return {
      ok: false,
      error: `Only ₱${available.toLocaleString(
        "en-PH"
      )} of resident credit is available to refund.`,
    };

  const refund = await prisma.$transaction(async (tx) => {
    const r = await tx.refund.create({
      data: {
        orgId: org.id,
        propertyId,
        amount,
        method: d.method,
        reference: d.reference || null,
        reason: d.reason,
        refundedById: user.id,
      },
    });
    await tx.property.update({
      where: { id: propertyId },
      data: { creditBalance: { decrement: amount } },
    });
    return r;
  });
  await postRefund(refund.id);

  await logAudit({
    action: "refund.issue",
    target: property.unitNumber,
    detail: `${d.method} ₱${amount.toLocaleString("en-PH")}`,
  });

  const users = property.homeowners
    .map((h) => h.user)
    .filter((u): u is Recipient => Boolean(u));
  if (users.length)
    await deliver({
      users,
      type: "PAYMENT_REFUNDED",
      title: `Refund issued — ${property.unitNumber}`,
      body: `₱${amount.toLocaleString("en-PH")} was refunded to you via ${d.method}${
        d.reference ? ` (ref ${d.reference})` : ""
      }.`,
      href: "/portal",
    }).catch(() => {});

  revalidateProperty(propertyId);
  return { ok: true };
}

/* ───────────────────────────── people ────────────────────────────── */

const personSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required"),
  role: z.enum(["OWNER", "CO_OWNER", "RENTER"]),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  makePrimary: z.boolean().optional(),
});

async function assertPropertyInOrg(propertyId: string) {
  const { org } = await getCurrentOrgContext();
  const property = await prisma.property.findFirst({
    where: { id: propertyId, orgId: org.id },
  });
  return property ? org.id : null;
}

export async function addHomeowner(
  propertyId: string,
  input: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = personSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  if (!(await assertPropertyInOrg(propertyId)))
    return { ok: false, error: "Property not found" };

  const d = parsed.data;
  const existing = await prisma.homeowner.count({ where: { propertyId } });
  const makePrimary = d.makePrimary || existing === 0;

  await prisma.$transaction(async (tx) => {
    if (makePrimary)
      await tx.homeowner.updateMany({
        where: { propertyId },
        data: { isPrimary: false },
      });
    await tx.homeowner.create({
      data: {
        propertyId,
        fullName: d.fullName,
        role: d.role,
        email: d.email || null,
        phone: d.phone || null,
        isPrimary: makePrimary,
      },
    });
  });

  revalidateProperty(propertyId);
  return { ok: true };
}

export async function updateHomeowner(
  id: string,
  input: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = personSchema.omit({ makePrimary: true }).safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const person = await prisma.homeowner.findFirst({
    where: { id, property: { orgId: org.id } },
  });
  if (!person) return { ok: false, error: "Person not found" };

  const d = parsed.data;
  await prisma.homeowner.update({
    where: { id },
    data: {
      fullName: d.fullName,
      role: d.role,
      email: d.email || null,
      phone: d.phone || null,
    },
  });

  revalidateProperty(person.propertyId);
  return { ok: true };
}

export async function setPrimaryHomeowner(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const { org } = await getCurrentOrgContext();
  const person = await prisma.homeowner.findFirst({
    where: { id, property: { orgId: org.id } },
  });
  if (!person) return { ok: false, error: "Person not found" };

  await prisma.$transaction([
    prisma.homeowner.updateMany({
      where: { propertyId: person.propertyId },
      data: { isPrimary: false },
    }),
    prisma.homeowner.update({ where: { id }, data: { isPrimary: true } }),
  ]);

  revalidateProperty(person.propertyId);
  return { ok: true };
}

/** Provision a homeowner-portal login for a Homeowner record that has an email. */
export async function inviteHomeowner(
  id: string
): Promise<Result<{ actionLink: string | null }>> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const person = await prisma.homeowner.findFirst({
    where: { id, property: { orgId: org.id } },
    include: { property: { select: { id: true } } },
  });
  if (!person) return { ok: false, error: "Person not found" };
  if (!person.email)
    return { ok: false, error: "Add an email for this person first" };
  if (person.userId) return { ok: false, error: "Already invited" };

  const existing = await prisma.user.findUnique({
    where: { email: person.email },
  });
  if (existing) {
    // Same email already has a login in this HOA — a co-owner, or a staff
    // member who also lives here. Link this record to it (no new invite, no
    // role change) rather than erroring.
    if (existing.orgId === org.id && !existing.deactivatedAt) {
      await prisma.homeowner.update({
        where: { id },
        data: { userId: existing.id },
      });
      await logAudit({
        action: "homeowner.link_existing",
        target: person.fullName,
        detail:
          existing.role === "HOMEOWNER"
            ? undefined
            : `also a ${existing.role.toLowerCase().replace("_", " ")}`,
      });
      revalidateProperty(person.property.id);
      return { ok: true, actionLink: null };
    }
    return { ok: false, error: "That email already has an account" };
  }

  const invite = await generateInviteLink(person.email, person.fullName);
  if (!invite.ok) return invite;

  const user = await prisma.user.create({
    data: {
      orgId: org.id,
      authId: invite.authId,
      email: person.email,
      fullName: person.fullName,
      role: "HOMEOWNER",
    },
  });
  await prisma.homeowner.update({
    where: { id },
    data: { userId: user.id },
  });

  revalidateProperty(person.property.id);
  return { ok: true, actionLink: invite.actionLink };
}

export async function removeHomeowner(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const { org } = await getCurrentOrgContext();
  const person = await prisma.homeowner.findFirst({
    where: { id, property: { orgId: org.id } },
  });
  if (!person) return { ok: false, error: "Person not found" };

  await prisma.homeowner.delete({ where: { id } });

  // promote the oldest remaining person if we removed the primary contact
  if (person.isPrimary) {
    const next = await prisma.homeowner.findFirst({
      where: { propertyId: person.propertyId },
      orderBy: { createdAt: "asc" },
    });
    if (next)
      await prisma.homeowner.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
  }

  revalidateProperty(person.propertyId);
  return { ok: true };
}
