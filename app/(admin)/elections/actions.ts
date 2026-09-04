"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ElectionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { deliver, recipientSelect } from "@/lib/notifications";
import { uploadDocument } from "@/lib/documents";
import { finalizeElection } from "@/lib/elections";
import { unitInGoodStanding } from "@/lib/good-standing";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/elections");
  revalidatePath("/portal/elections");
  revalidatePath("/portal", "layout");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/elections/${id}`);
}

async function guard() {
  return denyUnless("election:manage");
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
    type: "BOARD_ELECTION",
    href: "/portal/elections",
    ...opts,
  }).catch(() => {});
}

/* ─────────────────────────── create / edit ──────────────────────── */

const electionSchema = z.object({
  title: z.string().trim().min(3, "Give the election a title").max(200),
  description: z.string().trim().min(5, "Describe the election").max(8000),
  seats: z.coerce.number().int().min(1, "At least one seat").max(25),
  opensAt: z.string().min(1, "Pick when voting opens"),
  closesAt: z.string().min(1, "Pick when voting closes"),
  quorumPct: z.coerce.number().int().min(0).max(100),
  termMonths: z.coerce.number().int().min(1).max(60),
  meetingId: z.string().optional().or(z.literal("")),
});

function parseWindow(
  opensAtRaw: string,
  closesAtRaw: string
): { ok: true; opensAt: Date; closesAt: Date } | { ok: false; error: string } {
  const opensAt = new Date(`${opensAtRaw}+08:00`);
  const closesAt = new Date(`${closesAtRaw}+08:00`);
  if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime()))
    return { ok: false, error: "Enter valid opening and closing times" };
  if (closesAt <= opensAt)
    return { ok: false, error: "Voting must close after it opens" };
  return { ok: true, opensAt, closesAt };
}

export async function createElection(input: unknown): Promise<Result<{ id: string }>> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = electionSchema.safeParse(input);
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

  const election = await prisma.election.create({
    data: {
      orgId: org.id,
      createdById: user.id,
      title: d.title,
      description: d.description,
      seats: d.seats,
      opensAt: win.opensAt,
      closesAt: win.closesAt,
      quorumPct: d.quorumPct,
      termMonths: d.termMonths,
      meetingId,
    },
  });

  await logAudit({ action: "election.create", target: d.title });
  revalidate(election.id);
  return { ok: true, id: election.id };
}

export async function updateElection(id: string, input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = electionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const election = await prisma.election.findFirst({ where: { id, orgId: org.id } });
  if (!election) return { ok: false, error: "Election not found" };
  if (election.status !== "DRAFT")
    return { ok: false, error: "Only a draft election can be edited" };

  const d = parsed.data;
  const win = parseWindow(d.opensAt, d.closesAt);
  if (!win.ok) return { ok: false, error: win.error };

  await prisma.election.update({
    where: { id },
    data: {
      title: d.title,
      description: d.description,
      seats: d.seats,
      opensAt: win.opensAt,
      closesAt: win.closesAt,
      quorumPct: d.quorumPct,
      termMonths: d.termMonths,
    },
  });

  await logAudit({ action: "election.update", target: d.title });
  revalidate(id);
  return { ok: true };
}

/* ─────────────────────────── candidates ─────────────────────────── */

const candidateSchema = z.object({
  homeownerId: z.string().optional().or(z.literal("")),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function addCandidate(
  electionId: string,
  input: unknown
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = candidateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const election = await prisma.election.findFirst({
    where: { id: electionId, orgId: org.id },
  });
  if (!election) return { ok: false, error: "Election not found" };
  if (election.status !== "DRAFT")
    return { ok: false, error: "Add candidates while the election is still a draft." };

  const d = parsed.data;
  let homeownerId: string | null = null;
  let name = d.name?.trim() ?? "";

  if (d.homeownerId) {
    const h = await prisma.homeowner.findFirst({
      where: {
        id: d.homeownerId,
        property: { orgId: org.id, archivedAt: null },
      },
      select: { id: true, fullName: true, propertyId: true },
    });
    if (!h) return { ok: false, error: "That member isn't on record." };
    homeownerId = h.id;
    if (!name) name = h.fullName;
    const dupe = await prisma.electionCandidate.findFirst({
      where: { electionId, homeownerId },
    });
    if (dupe) return { ok: false, error: "That member is already a candidate." };
    if (!(await unitInGoodStanding(org.id, h.propertyId)))
      return {
        ok: false,
        error:
          "That member is behind on dues and can't run — settle the balance first.",
      };
  }
  if (!name) return { ok: false, error: "Pick a member or type the candidate's name." };

  await prisma.electionCandidate.create({
    data: { electionId, homeownerId, name, bio: d.bio || null },
  });
  await logAudit({ action: "candidate.add", target: name });
  revalidate(electionId);
  return { ok: true };
}

export async function removeCandidate(candidateId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const c = await prisma.electionCandidate.findFirst({
    where: { id: candidateId, election: { orgId: org.id } },
    include: { election: { select: { id: true, status: true } } },
  });
  if (!c) return { ok: false, error: "Candidate not found" };
  if (c.election.status !== "DRAFT")
    return {
      ok: false,
      error: "The election is open — withdraw the candidate instead of removing them.",
    };

  await prisma.electionCandidate.delete({ where: { id: candidateId } });
  await logAudit({ action: "candidate.remove", target: c.name });
  revalidate(c.election.id);
  return { ok: true };
}

export async function withdrawCandidate(
  candidateId: string,
  withdrawn: boolean
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const c = await prisma.electionCandidate.findFirst({
    where: { id: candidateId, election: { orgId: org.id } },
    include: { election: { select: { id: true } } },
  });
  if (!c) return { ok: false, error: "Candidate not found" };

  await prisma.electionCandidate.update({
    where: { id: candidateId },
    data: { withdrawn },
  });
  await logAudit({
    action: "candidate.withdraw",
    target: c.name,
    detail: withdrawn ? "withdrawn" : "reinstated",
  });
  revalidate(c.election.id);
  return { ok: true };
}

/* ─────────────────────────── lifecycle ──────────────────────────── */

export async function setElectionStatus(
  id: string,
  status: Extract<ElectionStatus, "OPEN" | "CLOSED" | "CANCELLED">
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const election = await prisma.election.findFirst({
    where: { id, orgId: org.id },
    include: { _count: { select: { candidates: true } } },
  });
  if (!election) return { ok: false, error: "Election not found" };

  const allowed =
    (status === "OPEN" && election.status === "DRAFT") ||
    (status === "CLOSED" && election.status === "OPEN") ||
    (status === "CANCELLED" && election.status !== "CANCELLED");
  if (!allowed)
    return { ok: false, error: `Can't move this election to ${status.toLowerCase()}` };

  if (status === "OPEN" && election._count.candidates < election.seats)
    return {
      ok: false,
      error: `Add at least ${election.seats} candidate${
        election.seats === 1 ? "" : "s"
      } before opening.`,
    };

  await prisma.election.update({ where: { id }, data: { status } });

  if (status === "OPEN") {
    await logAudit({ action: "election.open", target: election.title });
    await notifyResidents(org.id, {
      title: `Board election open — ${election.title}`,
      body: `Voting is open until ${fmtDate(
        election.closesAt
      )}. Pick up to ${election.seats} candidate${
        election.seats === 1 ? "" : "s"
      } in the portal.`,
    });
  } else if (status === "CLOSED") {
    await logAudit({ action: "election.close", target: election.title });
  } else {
    await logAudit({ action: "election.cancel", target: election.title });
    await notifyResidents(org.id, {
      title: `Board election cancelled — ${election.title}`,
      body: `The election scheduled to close ${fmtDate(
        election.closesAt
      )} has been called off.`,
    });
  }

  revalidate(id);
  return { ok: true };
}

export async function deleteElection(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const election = await prisma.election.findFirst({ where: { id, orgId: org.id } });
  if (!election) return { ok: false, error: "Election not found" };
  if (election.status === "OPEN" || election.status === "CLOSED")
    return {
      ok: false,
      error: "An open or closed election is part of the record — cancel it instead.",
    };

  await prisma.election.delete({ where: { id } });
  revalidate();
  return { ok: true };
}

/* ─────────────────────────── finalize / result ─────────────────── */

export async function finalizeElectionAction(
  id: string,
  setBoardRole: boolean
): Promise<Result<{ trustees: number }>> {
  const denied = await guard();
  if (denied) return denied;

  const { org, user } = await getCurrentOrgContext();
  const election = await prisma.election.findFirst({ where: { id, orgId: org.id } });
  if (!election) return { ok: false, error: "Election not found" };

  const res = await finalizeElection({
    electionId: id,
    setBoardRole,
    actorId: user.id,
  });
  if (!res.ok) return res;

  revalidatePath("/board");
  revalidatePath("/portal/board");
  revalidatePath("/team");
  revalidate(id);
  return { ok: true, trustees: res.trustees };
}

export async function publishElectionResult(id: string, fd: FormData): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org, user } = await getCurrentOrgContext();
  const election = await prisma.election.findFirst({ where: { id, orgId: org.id } });
  if (!election) return { ok: false, error: "Election not found" };
  if (election.status !== "CLOSED")
    return { ok: false, error: "Close the election before publishing the result" };

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, error: "Choose the result document (PDF or Word)" };

  const uploaded = await uploadDocument(file, { orgId: org.id });
  if (!uploaded)
    return { ok: false, error: "That file type isn't supported, or it's over 20 MB" };

  const doc = await prisma.document.create({
    data: {
      orgId: org.id,
      title: `Election result — ${election.title}`,
      description: `Voting closed ${fmtDate(election.closesAt)}`,
      category: "BOARD_MINUTES",
      staffOnly: false,
      storagePath: uploaded.storagePath,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      uploadedById: user.id,
    },
  });

  await prisma.election.update({
    where: { id },
    data: { resultDocumentId: doc.id },
  });

  await logAudit({ action: "election.result", target: election.title });
  await notifyResidents(org.id, {
    title: `Election result published — ${election.title}`,
    body: "The results document is now in the document library.",
  });

  revalidatePath("/documents");
  revalidate(id);
  return { ok: true };
}
