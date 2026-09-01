"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const contentSchema = z.object({
  title: z.string().trim().min(3, "Give it a title"),
  body: z.string().trim().min(1, "Write something"),
});

function revalidate() {
  revalidatePath("/announcements");
  revalidatePath("/portal");
}

async function guard(): Promise<{ ok: false; error: string } | null> {
  return denyUnless("announcement:write");
}

export async function createAnnouncement(
  input: unknown & { publish?: boolean }
): Promise<Result<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const publish = Boolean((input as { publish?: boolean }).publish);

  const a = await prisma.announcement.create({
    data: {
      orgId: org.id,
      createdById: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      publishedAt: publish ? new Date() : null,
    },
  });

  revalidate();
  return { ok: true, id: a.id };
}

export async function updateAnnouncement(
  id: string,
  input: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const existing = await prisma.announcement.findFirst({
    where: { id, orgId: org.id },
  });
  if (!existing) return { ok: false, error: "Announcement not found" };

  await prisma.announcement.update({
    where: { id },
    data: { title: parsed.data.title, body: parsed.data.body },
  });

  revalidate();
  return { ok: true };
}

export async function setAnnouncementPublished(
  id: string,
  published: boolean
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const { org } = await getCurrentOrgContext();
  const existing = await prisma.announcement.findFirst({
    where: { id, orgId: org.id },
  });
  if (!existing) return { ok: false, error: "Announcement not found" };

  await prisma.announcement.update({
    where: { id },
    // re-publishing refreshes the date; unpublishing clears it
    data: { publishedAt: published ? new Date() : null },
  });

  revalidate();
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;
  const { org } = await getCurrentOrgContext();
  const existing = await prisma.announcement.findFirst({
    where: { id, orgId: org.id },
  });
  if (!existing) return { ok: false, error: "Announcement not found" };

  await prisma.announcement.delete({ where: { id } });

  revalidate();
  return { ok: true };
}
