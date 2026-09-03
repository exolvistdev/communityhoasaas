"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ViolationCategory, ViolationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { postFineIssued } from "@/lib/ledger";
import { deliver, recipientSelect, type Recipient } from "@/lib/notifications";
import {
  isViolationCategory,
  canTransitionViolation,
  nextNoticeNumber,
  RESOLVED_STATUSES,
  VIOLATION_CATEGORY_LABEL,
} from "@/lib/violation";
import {
  uploadViolationPhotos,
  deleteViolationPhotos,
} from "@/lib/violation-photos";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/violations");
  revalidatePath("/dashboard");
  revalidatePath("/portal/violations");
  if (id) {
    revalidatePath(`/violations/${id}`);
    revalidatePath(`/violation-letters/${id}`);
  }
}

async function guard() {
  return denyUnless("violation:manage");
}

/** Linked-login recipients for a unit. */
async function unitRecipients(propertyId: string): Promise<Recipient[]> {
  const rows = await prisma.homeowner.findMany({
    where: { propertyId, userId: { not: null } },
    select: { user: { select: recipientSelect } },
  });
  return rows.map((r) => r.user).filter((u): u is Recipient => Boolean(u));
}

/* ─────────────────────────── log a violation ─────────────────────── */

const logSchema = z.object({
  propertyId: z.string().uuid("Pick a unit"),
  category: z.string().refine(isViolationCategory, "Pick a category"),
  description: z.string().trim().min(5, "Describe the violation").max(2000),
  occurredAt: z.string().min(1, "When did it happen?"),
  cureByDate: z.string().optional().or(z.literal("")),
});

const day = (ymd: string) => new Date(`${ymd}T12:00:00+08:00`);

export async function logViolation(fd: FormData): Promise<Result<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = logSchema.safeParse({
    propertyId: fd.get("propertyId"),
    category: fd.get("category"),
    description: fd.get("description"),
    occurredAt: fd.get("occurredAt"),
    cureByDate: fd.get("cureByDate") ?? "",
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const d = parsed.data;
  const property = await prisma.property.findFirst({
    where: { id: d.propertyId, orgId: org.id },
    select: { id: true, unitNumber: true },
  });
  if (!property) return { ok: false, error: "Unit not found" };

  const occurredAt = day(d.occurredAt);
  if (Number.isNaN(occurredAt.getTime()))
    return { ok: false, error: "Enter a valid date" };

  const violation = await prisma.violation.create({
    data: {
      orgId: org.id,
      propertyId: property.id,
      reportedById: user.id,
      category: d.category as ViolationCategory,
      description: d.description,
      occurredAt,
      cureByDate: d.cureByDate ? day(d.cureByDate) : null,
    },
  });

  const files = fd.getAll("photos").filter((f): f is File => f instanceof File);
  if (files.length) {
    const paths = await uploadViolationPhotos(files, {
      orgId: org.id,
      violationId: violation.id,
    });
    if (paths.length)
      await prisma.violation.update({
        where: { id: violation.id },
        data: { photos: paths },
      });
  }

  await logAudit({
    action: "violation.log",
    target: `${property.unitNumber} · ${VIOLATION_CATEGORY_LABEL[d.category as ViolationCategory]}`,
  });

  const users = await unitRecipients(property.id);
  if (users.length)
    await deliver({
      users,
      type: "VIOLATION_NOTICE",
      title: `Violation recorded — ${property.unitNumber}`,
      body: `A ${VIOLATION_CATEGORY_LABEL[
        d.category as ViolationCategory
      ].toLowerCase()} violation was recorded for your unit.${
        d.cureByDate ? ` Please resolve it by ${d.cureByDate}.` : ""
      }`,
      href: "/portal/violations",
    }).catch(() => {});

  revalidate(violation.id);
  return { ok: true, id: violation.id };
}

/* ───────────────────────── status transitions ───────────────────── */

const statusSchema = z.object({
  status: z.enum(["OPEN", "CURED", "DISMISSED", "APPEALED"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function updateViolationStatus(
  id: string,
  input: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const violation = await prisma.violation.findFirst({
    where: { id, orgId: org.id },
    include: { property: { select: { unitNumber: true } } },
  });
  if (!violation) return { ok: false, error: "Violation not found" };

  const next = parsed.data.status as ViolationStatus;
  if (!canTransitionViolation(violation.status, next))
    return {
      ok: false,
      error: `Can't move a ${violation.status.toLowerCase()} violation to ${next.toLowerCase()}.`,
    };

  await prisma.violation.update({
    where: { id },
    data: {
      status: next,
      resolutionNote: parsed.data.note || null,
      resolvedAt: RESOLVED_STATUSES.includes(next) ? new Date() : null,
    },
  });

  await logAudit({
    action: "violation.status",
    target: violation.property.unitNumber,
    detail: `${violation.status.toLowerCase()} → ${next.toLowerCase()}`,
  });
  revalidate(id);
  return { ok: true };
}

/* ─────────────────────────── issue a fine ───────────────────────── */

const fineSchema = z.object({
  amount: z.coerce.number().positive("Enter a fine amount").max(1_000_000),
  dueDate: z.string().min(1, "Set a pay-by date"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function issueFineNotice(
  violationId: string,
  input: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = fineSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const violation = await prisma.violation.findFirst({
    where: { id: violationId, orgId: org.id },
    include: {
      property: { select: { id: true, unitNumber: true } },
      fineNotices: { select: { noticeNumber: true } },
    },
  });
  if (!violation) return { ok: false, error: "Violation not found" };

  const d = parsed.data;
  const dueDate = day(d.dueDate);
  if (Number.isNaN(dueDate.getTime()))
    return { ok: false, error: "Enter a valid pay-by date" };

  const number = nextNoticeNumber(violation.fineNotices);
  const catLabel = VIOLATION_CATEGORY_LABEL[violation.category];

  const invoice = await prisma.invoice.create({
    data: {
      propertyId: violation.property.id,
      amount: d.amount,
      period: null,
      dueDate,
      status: "SENT",
      memo: `Fine — ${violation.property.unitNumber} — ${catLabel} (notice ${number})`,
    },
  });
  await postFineIssued(invoice.id);

  await prisma.fineNotice.create({
    data: {
      violationId,
      orgId: org.id,
      noticeNumber: number,
      amount: d.amount,
      invoiceId: invoice.id,
      issuedById: user.id,
      issuedAt: new Date(),
      dueDate,
      note: d.note || null,
    },
  });

  await logAudit({
    action: "violation.fine",
    target: `${violation.property.unitNumber} · notice ${number}`,
    detail: `₱${d.amount.toLocaleString("en-PH")}`,
  });

  const users = await unitRecipients(violation.property.id);
  if (users.length)
    await deliver({
      users,
      type: "VIOLATION_NOTICE",
      title: `Fine issued — ${violation.property.unitNumber}`,
      body: `A ₱${d.amount.toLocaleString(
        "en-PH"
      )} fine (${catLabel}, notice ${number}) was added to your account, due ${d.dueDate}.`,
      href: "/portal/violations",
    }).catch(() => {});

  revalidate(violationId);
  revalidatePath("/billing");
  revalidatePath(`/properties/${violation.property.id}`);
  return { ok: true };
}

/* ─────────────────────────── delete ─────────────────────────────── */

export async function deleteViolation(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const violation = await prisma.violation.findFirst({
    where: { id, orgId: org.id },
    include: {
      fineNotices: { select: { id: true } },
      property: { select: { unitNumber: true } },
    },
  });
  if (!violation) return { ok: false, error: "Violation not found" };
  if (violation.fineNotices.length > 0)
    return {
      ok: false,
      error:
        "This violation has fine notices on the resident's account — dismiss it instead of deleting.",
    };

  await deleteViolationPhotos(violation.photos);
  await prisma.violation.delete({ where: { id } });

  await logAudit({
    action: "violation.delete",
    target: violation.property.unitNumber,
  });
  revalidate();
  return { ok: true };
}
