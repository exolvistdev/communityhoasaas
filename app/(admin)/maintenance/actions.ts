"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MaintenanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { deliver, recipientSelect, type Recipient } from "@/lib/notifications";
import { canTransitionMaintenance } from "@/lib/maintenance";

type Result = { ok: true } | { ok: false; error: string };

function revalidate(id: string) {
  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/portal/maintenance");
  revalidatePath(`/portal/maintenance/${id}`);
}

async function guard() {
  return denyUnless("maintenance:manage");
}

async function orgRequest(id: string) {
  const { org } = await getCurrentOrgContext();
  return prisma.maintenanceRequest.findFirst({
    where: { id, orgId: org.id },
    include: {
      requester: { select: recipientSelect },
      property: { select: { unitNumber: true } },
    },
  });
}

function notifyRequester(
  requester: Recipient | null,
  opts: { title: string; body: string; href: string }
) {
  if (!requester) return Promise.resolve();
  return deliver({
    users: [requester],
    type: "MAINTENANCE_UPDATE",
    ...opts,
  }).catch(() => {});
}

const unitLabel = (r: Awaited<ReturnType<typeof orgRequest>>) =>
  r?.isCommonArea ? "common area" : r?.property?.unitNumber ?? "your unit";

/* ─────────────────────────── status ─────────────────────────────── */

const statusSchema = z.object({
  status: z.enum([
    "OPEN",
    "ACKNOWLEDGED",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "CANCELLED",
  ]),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function setStatus(id: string, input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const request = await orgRequest(id);
  if (!request) return { ok: false, error: "Request not found" };

  const next = parsed.data.status as MaintenanceStatus;
  if (!canTransitionMaintenance(request.status, next, "staff"))
    return {
      ok: false,
      error: `Can't move a ${request.status.toLowerCase()} request to ${next.toLowerCase()}.`,
    };

  const { user } = await getCurrentOrgContext();
  const done = next === "RESOLVED" || next === "CLOSED" || next === "CANCELLED";

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceRequest.update({
      where: { id },
      data: { status: next, resolvedAt: done ? new Date() : null },
    });
    if (parsed.data.note)
      await tx.maintenanceComment.create({
        data: { requestId: id, authorId: user.id, body: parsed.data.note, staffOnly: false },
      });
  });

  await logAudit({
    action: "maintenance.status",
    target: `${unitLabel(request)} · ${request.title}`,
    detail: `${request.status.toLowerCase()} → ${next.toLowerCase()}`,
  });
  await notifyRequester(request.requester, {
    title: `Maintenance update — ${request.title}`,
    body: `Your request is now "${next.replace("_", " ").toLowerCase()}".${
      parsed.data.note ? ` ${parsed.data.note}` : ""
    }`,
    href: `/portal/maintenance/${id}`,
  });

  revalidate(id);
  return { ok: true };
}

/* ─────────────────────────── assign ─────────────────────────────── */

const assignSchema = z.object({
  assignedToId: z.string().uuid().optional().or(z.literal("")),
  vendorId: z.string().uuid().optional().or(z.literal("")),
});

export async function assignRequest(id: string, input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const { org } = await getCurrentOrgContext();
  const request = await orgRequest(id);
  if (!request) return { ok: false, error: "Request not found" };

  const d = parsed.data;
  if (d.assignedToId) {
    const staff = await prisma.user.findFirst({
      where: { id: d.assignedToId, orgId: org.id, deactivatedAt: null },
    });
    if (!staff) return { ok: false, error: "Staff member not found" };
  }
  if (d.vendorId) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: d.vendorId, orgId: org.id },
    });
    if (!vendor) return { ok: false, error: "Vendor not found" };
  }

  await prisma.maintenanceRequest.update({
    where: { id },
    data: {
      assignedToId: d.assignedToId || null,
      vendorId: d.vendorId || null,
    },
  });

  await logAudit({
    action: "maintenance.assign",
    target: `${unitLabel(request)} · ${request.title}`,
  });
  revalidate(id);
  return { ok: true };
}

/* ─────────────────────────── link a bill ────────────────────────── */

export async function linkBill(
  id: string,
  billId: string | null
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const request = await orgRequest(id);
  if (!request) return { ok: false, error: "Request not found" };

  if (billId) {
    const bill = await prisma.bill.findFirst({
      where: { id: billId, orgId: org.id },
    });
    if (!bill) return { ok: false, error: "Bill not found" };
  }

  await prisma.maintenanceRequest.update({
    where: { id },
    data: { billId: billId || null },
  });
  revalidate(id);
  return { ok: true };
}

/* ─────────────────────────── comment ────────────────────────────── */

const commentSchema = z.object({
  body: z.string().trim().min(1, "Write a message").max(4000),
  staffOnly: z.preprocess(
    (v) => v === true || v === "true" || v === "on",
    z.boolean()
  ),
});

export async function addStaffComment(
  id: string,
  input: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = commentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user } = await getCurrentOrgContext();
  const request = await orgRequest(id);
  if (!request) return { ok: false, error: "Request not found" };

  await prisma.maintenanceComment.create({
    data: {
      requestId: id,
      authorId: user.id,
      body: parsed.data.body,
      staffOnly: parsed.data.staffOnly,
    },
  });

  if (!parsed.data.staffOnly)
    await notifyRequester(request.requester, {
      title: `Message on your maintenance request`,
      body: parsed.data.body.slice(0, 200),
      href: `/portal/maintenance/${id}`,
    });

  revalidate(id);
  return { ok: true };
}
