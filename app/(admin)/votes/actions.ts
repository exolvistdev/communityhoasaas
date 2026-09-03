"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { VoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { deliver, recipientSelect } from "@/lib/notifications";
import { uploadDocument } from "@/lib/documents";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/votes");
  revalidatePath("/portal/votes");
  revalidatePath("/portal", "layout");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/votes/${id}`);
}

async function guard() {
  return denyUnless("vote:manage");
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });

async function notifyResidents(orgId: string, opts: { title: string; body: string }) {
  const users = await prisma.user.findMany({
    where: { orgId, deactivatedAt: null, homeowners: { some: {} } },
    select: recipientSelect,
  });
  if (!users.length) return;
  await deliver({
    users,
    type: "BOARD_VOTE",
    href: "/portal/votes",
    ...opts,
  }).catch(() => {});
}

/* ─────────────────────────── create / edit ──────────────────────── */

const voteSchema = z.object({
  title: z.string().trim().min(3, "Give the motion a title").max(200),
  description: z.string().trim().min(5, "Describe what's being voted on").max(8000),
  opensAt: z.string().min(1, "Pick when voting opens"),
  closesAt: z.string().min(1, "Pick when voting closes"),
  quorumPct: z.coerce.number().int().min(0).max(100),
  threshold: z.enum(["MAJORITY", "TWO_THIRDS"]),
  meetingId: z.string().optional().or(z.literal("")),
});

function parseWindow(
  opensAtRaw: string,
  closesAtRaw: string
):
  | { ok: true; opensAt: Date; closesAt: Date }
  | { ok: false; error: string } {
  const opensAt = new Date(`${opensAtRaw}+08:00`);
  const closesAt = new Date(`${closesAtRaw}+08:00`);
  if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime()))
    return { ok: false, error: "Enter valid opening and closing times" };
  if (closesAt <= opensAt)
    return { ok: false, error: "Voting must close after it opens" };
  return { ok: true, opensAt, closesAt };
}

export async function createVote(input: unknown): Promise<Result<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { org, user } = await getCurrentOrgContext();
  const d = parsed.data;
  const win = parseWindow(d.opensAt, d.closesAt);
  if (!win.ok) return { ok: false, error: win.error };

  const meetingId =
    d.meetingId && d.meetingId.length
      ? (await prisma.boardMeeting.findFirst({
          where: { id: d.meetingId, orgId: org.id },
          select: { id: true },
        }))?.id ?? null
      : null;

  const vote = await prisma.boardVote.create({
    data: {
      orgId: org.id,
      createdById: user.id,
      title: d.title,
      description: d.description,
      opensAt: win.opensAt,
      closesAt: win.closesAt,
      quorumPct: d.quorumPct,
      threshold: d.threshold,
      meetingId,
    },
  });

  await logAudit({ action: "vote.create", target: d.title });
  revalidate(vote.id);
  return { ok: true, id: vote.id };
}

export async function updateVote(id: string, input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const vote = await prisma.boardVote.findFirst({ where: { id, orgId: org.id } });
  if (!vote) return { ok: false, error: "Vote not found" };
  if (vote.status !== "DRAFT")
    return { ok: false, error: "Only a draft vote can be edited" };

  const d = parsed.data;
  const win = parseWindow(d.opensAt, d.closesAt);
  if (!win.ok) return { ok: false, error: win.error };

  await prisma.boardVote.update({
    where: { id },
    data: {
      title: d.title,
      description: d.description,
      opensAt: win.opensAt,
      closesAt: win.closesAt,
      quorumPct: d.quorumPct,
      threshold: d.threshold,
    },
  });

  await logAudit({ action: "vote.update", target: d.title });
  revalidate(id);
  return { ok: true };
}

/* ─────────────────────────── lifecycle ──────────────────────────── */

export async function setVoteStatus(
  id: string,
  status: Extract<VoteStatus, "OPEN" | "CLOSED" | "CANCELLED">
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const vote = await prisma.boardVote.findFirst({ where: { id, orgId: org.id } });
  if (!vote) return { ok: false, error: "Vote not found" };

  const allowed =
    (status === "OPEN" && vote.status === "DRAFT") ||
    (status === "CLOSED" && vote.status === "OPEN") ||
    (status === "CANCELLED" && vote.status !== "CANCELLED");
  if (!allowed)
    return { ok: false, error: `Can't move this vote to ${status.toLowerCase()}` };

  await prisma.boardVote.update({ where: { id }, data: { status } });

  if (status === "OPEN") {
    await logAudit({ action: "vote.open", target: vote.title });
    await notifyResidents(org.id, {
      title: `Vote open — ${vote.title}`,
      body: `Voting is open until ${fmtDate(vote.closesAt)}. Cast your ballot in the portal.`,
    });
  } else if (status === "CLOSED") {
    await logAudit({ action: "vote.close", target: vote.title });
  } else {
    await logAudit({ action: "vote.cancel", target: vote.title });
    await notifyResidents(org.id, {
      title: `Vote cancelled — ${vote.title}`,
      body: `The vote scheduled to close ${fmtDate(vote.closesAt)} has been called off.`,
    });
  }

  revalidate(id);
  return { ok: true };
}

export async function deleteVote(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const vote = await prisma.boardVote.findFirst({ where: { id, orgId: org.id } });
  if (!vote) return { ok: false, error: "Vote not found" };
  if (vote.status === "OPEN" || vote.status === "CLOSED")
    return {
      ok: false,
      error: "An open or closed vote is part of the record — cancel it instead.",
    };

  await prisma.boardVote.delete({ where: { id } });
  revalidate();
  return { ok: true };
}

/* ─────────────────────────── result ────────────────────────────── */

export async function publishVoteResult(id: string, fd: FormData): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org, user } = await getCurrentOrgContext();
  const vote = await prisma.boardVote.findFirst({ where: { id, orgId: org.id } });
  if (!vote) return { ok: false, error: "Vote not found" };
  if (vote.status !== "CLOSED")
    return { ok: false, error: "Close the vote before publishing the result" };

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose the result document (PDF or Word)" };

  const uploaded = await uploadDocument(file, { orgId: org.id });
  if (!uploaded)
    return { ok: false, error: "That file type isn't supported, or it's over 20 MB" };

  const doc = await prisma.document.create({
    data: {
      orgId: org.id,
      title: `Vote result — ${vote.title}`,
      description: `Voting closed ${fmtDate(vote.closesAt)}`,
      category: "BOARD_MINUTES",
      staffOnly: false,
      storagePath: uploaded.storagePath,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      uploadedById: user.id,
    },
  });

  await prisma.boardVote.update({
    where: { id },
    data: { resultDocumentId: doc.id },
  });

  await logAudit({ action: "vote.result", target: vote.title });
  await notifyResidents(org.id, {
    title: `Vote result published — ${vote.title}`,
    body: `The outcome of the vote is now available in the document library.`,
  });

  revalidatePath("/documents");
  revalidate(id);
  return { ok: true };
}

/* ─────────────────────────── proxies ───────────────────────────── */

export async function revokeProxyAsStaff(proxyId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const proxy = await prisma.voteProxy.findFirst({
    where: { id: proxyId, orgId: org.id },
    include: { grantorProperty: { select: { unitNumber: true } } },
  });
  if (!proxy) return { ok: false, error: "Proxy not found" };
  if (proxy.revokedAt) return { ok: true };

  await prisma.voteProxy.update({
    where: { id: proxyId },
    data: { revokedAt: new Date() },
  });
  await logAudit({ action: "proxy.revoke", target: proxy.grantorProperty.unitNumber });
  revalidate();
  return { ok: true };
}
