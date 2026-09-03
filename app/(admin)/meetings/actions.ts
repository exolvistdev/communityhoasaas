"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MeetingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { deliver, recipientSelect } from "@/lib/notifications";
import { uploadDocument } from "@/lib/documents";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/meetings");
  revalidatePath("/portal/meetings");
  revalidatePath("/portal", "layout");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/meetings/${id}`);
}

async function guard() {
  return denyUnless("meeting:manage");
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });

/** Notify every linked homeowner about a meeting. */
async function notifyResidents(
  orgId: string,
  opts: { title: string; body: string }
) {
  const users = await prisma.user.findMany({
    where: { orgId, deactivatedAt: null, homeowners: { some: {} } },
    select: recipientSelect,
  });
  if (!users.length) return;
  await deliver({
    users,
    type: "BOARD_MEETING",
    href: "/portal/meetings",
    ...opts,
  }).catch(() => {});
}

/* ─────────────────────────── schedule / edit ────────────────────── */

const meetingSchema = z.object({
  title: z.string().trim().min(3, "Give the meeting a title").max(160),
  scheduledAt: z.string().min(1, "Pick a date and time"),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  agenda: z.string().trim().min(5, "Add an agenda").max(8000),
});

export async function scheduleMeeting(
  input: unknown
): Promise<Result<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const d = parsed.data;
  const scheduledAt = new Date(`${d.scheduledAt}+08:00`);
  if (Number.isNaN(scheduledAt.getTime()))
    return { ok: false, error: "Enter a valid date and time" };

  const meeting = await prisma.boardMeeting.create({
    data: {
      orgId: org.id,
      createdById: user.id,
      title: d.title,
      scheduledAt,
      location: d.location || null,
      agenda: d.agenda,
    },
  });

  await logAudit({ action: "meeting.schedule", target: d.title });
  await notifyResidents(org.id, {
    title: `Board meeting — ${d.title}`,
    body: `Scheduled for ${fmtDate(scheduledAt)}${
      d.location ? ` at ${d.location}` : ""
    }. Please RSVP in the portal.`,
  });

  revalidate(meeting.id);
  return { ok: true, id: meeting.id };
}

export async function updateMeeting(
  id: string,
  input: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const meeting = await prisma.boardMeeting.findFirst({
    where: { id, orgId: org.id },
  });
  if (!meeting) return { ok: false, error: "Meeting not found" };

  const d = parsed.data;
  const scheduledAt = new Date(`${d.scheduledAt}+08:00`);
  if (Number.isNaN(scheduledAt.getTime()))
    return { ok: false, error: "Enter a valid date and time" };

  const timeChanged = scheduledAt.getTime() !== meeting.scheduledAt.getTime();

  await prisma.boardMeeting.update({
    where: { id },
    data: {
      title: d.title,
      scheduledAt,
      location: d.location || null,
      agenda: d.agenda,
    },
  });

  await logAudit({ action: "meeting.update", target: d.title });
  if (timeChanged && meeting.status === "SCHEDULED")
    await notifyResidents(org.id, {
      title: `Board meeting rescheduled — ${d.title}`,
      body: `Now ${fmtDate(scheduledAt)}${d.location ? ` at ${d.location}` : ""}.`,
    });

  revalidate(id);
  return { ok: true };
}

/* ─────────────────────────── status ─────────────────────────────── */

export async function setMeetingStatus(
  id: string,
  status: MeetingStatus
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const meeting = await prisma.boardMeeting.findFirst({
    where: { id, orgId: org.id },
  });
  if (!meeting) return { ok: false, error: "Meeting not found" };

  await prisma.boardMeeting.update({ where: { id }, data: { status } });

  if (status === "CANCELLED" && meeting.status !== "CANCELLED") {
    await logAudit({ action: "meeting.cancel", target: meeting.title });
    await notifyResidents(org.id, {
      title: `Board meeting cancelled — ${meeting.title}`,
      body: `The meeting set for ${fmtDate(meeting.scheduledAt)} has been called off.`,
    });
  }

  revalidate(id);
  return { ok: true };
}

export async function deleteMeeting(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const meeting = await prisma.boardMeeting.findFirst({
    where: { id, orgId: org.id },
  });
  if (!meeting) return { ok: false, error: "Meeting not found" };
  if (meeting.status === "HELD")
    return {
      ok: false,
      error: "A held meeting is part of the record — cancel it instead of deleting.",
    };

  await prisma.boardMeeting.delete({ where: { id } });
  revalidate();
  return { ok: true };
}

/* ─────────────────────────── minutes ────────────────────────────── */

export async function publishMinutes(
  id: string,
  fd: FormData
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org, user } = await getCurrentOrgContext();
  const meeting = await prisma.boardMeeting.findFirst({
    where: { id, orgId: org.id },
  });
  if (!meeting) return { ok: false, error: "Meeting not found" };

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose the minutes file (PDF or Word)" };

  const uploaded = await uploadDocument(file, { orgId: org.id });
  if (!uploaded)
    return { ok: false, error: "That file type isn't supported, or it's over 20 MB" };

  const doc = await prisma.document.create({
    data: {
      orgId: org.id,
      title: `Minutes — ${meeting.title}`,
      description: `Board meeting held ${fmtDate(meeting.scheduledAt)}`,
      category: "BOARD_MINUTES",
      staffOnly: false,
      storagePath: uploaded.storagePath,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      uploadedById: user.id,
    },
  });

  await prisma.boardMeeting.update({
    where: { id },
    data: {
      minutesDocumentId: doc.id,
      status: meeting.status === "SCHEDULED" ? "HELD" : meeting.status,
    },
  });

  await logAudit({ action: "meeting.minutes", target: meeting.title });
  await notifyResidents(org.id, {
    title: `Minutes published — ${meeting.title}`,
    body: `The minutes for the ${fmtDate(meeting.scheduledAt)} board meeting are now available.`,
  });

  revalidatePath("/documents");
  revalidate(id);
  return { ok: true };
}
