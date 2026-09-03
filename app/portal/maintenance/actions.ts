"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MaintenanceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { deliver, staffRecipients } from "@/lib/notifications";
import {
  isMaintenanceCategory,
  canTransitionMaintenance,
  MAINTENANCE_CATEGORY_LABEL,
} from "@/lib/maintenance";
import { uploadMaintenancePhotos } from "@/lib/maintenance-photos";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/portal/maintenance");
  revalidatePath("/portal", "layout");
  revalidatePath("/maintenance");
  if (id) {
    revalidatePath(`/portal/maintenance/${id}`);
    revalidatePath(`/maintenance/${id}`);
  }
}

async function notifyStaff(
  orgId: string,
  opts: { title: string; body: string; href: string }
) {
  const staff = await staffRecipients(orgId, [
    "ADMIN",
    "TREASURER",
    "BOARD_MEMBER",
  ]).catch(() => []);
  if (staff.length)
    await deliver({ users: staff, type: "MAINTENANCE_UPDATE", ...opts }).catch(
      () => {}
    );
}

/* ─────────────────────────── new request ────────────────────────── */

const createSchema = z.object({
  category: z.string().refine(isMaintenanceCategory, "Pick a category"),
  title: z.string().trim().min(4, "Give it a short title").max(160),
  description: z.string().trim().min(5, "Describe the problem").max(4000),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  isCommonArea: z.preprocess(
    (v) => v === true || v === "true" || v === "on",
    z.boolean()
  ),
});

export async function createRequest(
  fd: FormData
): Promise<Result<{ id: string }>> {
  const parsed = createSchema.safeParse({
    category: fd.get("category"),
    title: fd.get("title"),
    description: fd.get("description"),
    location: fd.get("location") ?? "",
    isCommonArea: fd.get("isCommonArea") ?? false,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user, org, property } = await getHomeownerContext();
  const d = parsed.data;
  if (!d.isCommonArea && !property)
    return {
      ok: false,
      error: "Your account isn't linked to a unit — file this as a common-area issue.",
    };

  const request = await prisma.maintenanceRequest.create({
    data: {
      orgId: org.id,
      propertyId: d.isCommonArea ? null : property!.id,
      requesterId: user.id,
      category: d.category as MaintenanceCategory,
      title: d.title,
      description: d.description,
      location: d.location || null,
      isCommonArea: d.isCommonArea,
    },
  });

  const files = fd.getAll("photos").filter((f): f is File => f instanceof File);
  if (files.length) {
    const paths = await uploadMaintenancePhotos(files, {
      orgId: org.id,
      requestId: request.id,
    });
    if (paths.length)
      await prisma.maintenanceRequest.update({
        where: { id: request.id },
        data: { photos: paths },
      });
  }

  await notifyStaff(org.id, {
    title: `New maintenance request — ${
      d.isCommonArea ? "common area" : property!.unitNumber
    }`,
    body: `${user.fullName}: ${d.title} (${MAINTENANCE_CATEGORY_LABEL[
      d.category as MaintenanceCategory
    ]})`,
    href: `/maintenance/${request.id}`,
  });

  revalidate(request.id);
  return { ok: true, id: request.id };
}

/* ─────────────────────────── comment ────────────────────────────── */

const commentSchema = z.object({
  body: z.string().trim().min(1, "Write a message").max(4000),
});

async function ownRequest(id: string, userId: string) {
  return prisma.maintenanceRequest.findFirst({
    where: { id, requesterId: userId },
    include: { assignedTo: { select: { fullName: true } } },
  });
}

export async function addComment(
  requestId: string,
  input: unknown
): Promise<Result> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user, org } = await getHomeownerContext();
  const request = await ownRequest(requestId, user.id);
  if (!request) return { ok: false, error: "Request not found" };
  if (request.status === "CANCELLED" || request.status === "CLOSED")
    return { ok: false, error: "This request is closed." };

  await prisma.maintenanceComment.create({
    data: { requestId, authorId: user.id, body: parsed.data.body, staffOnly: false },
  });

  await notifyStaff(org.id, {
    title: `Reply on a maintenance request`,
    body: `${user.fullName}: ${parsed.data.body.slice(0, 160)}`,
    href: `/maintenance/${requestId}`,
  });

  revalidate(requestId);
  return { ok: true };
}

/* ─────────────────────────── cancel ─────────────────────────────── */

export async function cancelRequest(requestId: string): Promise<Result> {
  const { user, org } = await getHomeownerContext();
  const request = await ownRequest(requestId, user.id);
  if (!request) return { ok: false, error: "Request not found" };
  if (!canTransitionMaintenance(request.status, "CANCELLED", "resident"))
    return {
      ok: false,
      error: "Work has already started — contact the HOA office to cancel.",
    };

  await prisma.maintenanceRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  });

  await notifyStaff(org.id, {
    title: `Maintenance request withdrawn`,
    body: `${user.fullName} cancelled "${request.title}".`,
    href: `/maintenance/${requestId}`,
  });

  revalidate(requestId);
  return { ok: true };
}
