"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { TrusteePosition } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  assignTrusteePosition,
  seatTrustee,
  reactivateTrustee as reactivateTrusteeLib,
} from "@/lib/board";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const POSITIONS = [
  "CHAIRPERSON",
  "VICE_CHAIRPERSON",
  "SECRETARY",
  "TREASURER",
  "MEMBER",
] as const;

async function guard() {
  return denyUnless("election:manage");
}

function revalidate() {
  revalidatePath("/board");
  revalidatePath("/portal/board");
  revalidatePath("/portal", "layout");
}

function parseDate(raw: string): Date | null {
  const d = new Date(`${raw}T12:00:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const addSchema = z.object({
  homeownerId: z.string().optional().or(z.literal("")),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  position: z.enum(POSITIONS),
  termStart: z.string().min(1),
  termEnd: z.string().min(1),
});

/** Appoint a trustee directly (no election). */
export async function addTrustee(input: unknown): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { org } = await getCurrentOrgContext();
  const d = parsed.data;

  const termStart = parseDate(d.termStart);
  const termEnd = parseDate(d.termEnd);
  if (!termStart || !termEnd) return { ok: false, error: "Enter valid term dates" };
  if (termEnd <= termStart)
    return { ok: false, error: "The term must end after it starts" };

  let homeownerId: string | null = null;
  let userId: string | null = null;
  let name = d.name?.trim() ?? "";

  if (d.homeownerId) {
    const h = await prisma.homeowner.findFirst({
      where: { id: d.homeownerId, property: { orgId: org.id, archivedAt: null } },
      select: { id: true, fullName: true, userId: true },
    });
    if (!h) return { ok: false, error: "That member isn't on record." };
    homeownerId = h.id;
    userId = h.userId;
    if (!name) name = h.fullName;
  }
  if (!name) return { ok: false, error: "Pick a member or type the trustee's name." };

  await seatTrustee({
    orgId: org.id,
    homeownerId,
    userId,
    name,
    position: d.position,
    termStart,
    termEnd,
  });

  await logAudit({ action: "trustee.add", target: name, detail: d.position });
  revalidate();
  return { ok: true };
}

export async function setTrusteePosition(
  trusteeId: string,
  position: TrusteePosition
): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const res = await assignTrusteePosition(org.id, trusteeId, position);
  if (!res.ok) return { ok: false, error: res.error };

  await logAudit({
    action: "trustee.update",
    target: res.name,
    detail: `→ ${position}`,
  });
  revalidate();
  return { ok: true };
}

export async function endTrusteeTerm(trusteeId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const trustee = await prisma.trustee.findFirst({
    where: { id: trusteeId, orgId: org.id },
  });
  if (!trustee) return { ok: false, error: "Trustee not found" };
  if (trustee.endedAt) return { ok: true };

  await prisma.trustee.update({
    where: { id: trusteeId },
    data: { endedAt: new Date() },
  });
  await logAudit({ action: "trustee.end", target: trustee.name });
  revalidate();
  return { ok: true };
}

/** Undo a term that was ended early. */
export async function reactivateTrusteeAction(trusteeId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const res = await reactivateTrusteeLib(org.id, trusteeId);
  if (!res.ok) return { ok: false, error: res.error };

  await logAudit({
    action: "trustee.update",
    target: res.name,
    detail: "reactivated",
  });
  revalidate();
  return { ok: true };
}

/** Delete a manually-appointed trustee row (election-seated ones stay on record). */
export async function removeTrustee(trusteeId: string): Promise<Result> {
  const denied = await guard();
  if (denied) return denied;

  const { org } = await getCurrentOrgContext();
  const trustee = await prisma.trustee.findFirst({
    where: { id: trusteeId, orgId: org.id },
  });
  if (!trustee) return { ok: false, error: "Trustee not found" };
  if (trustee.electionId)
    return {
      ok: false,
      error: "This trustee was elected — end their term instead of deleting.",
    };

  await prisma.trustee.delete({ where: { id: trusteeId } });
  await logAudit({ action: "trustee.remove", target: trustee.name });
  revalidate();
  return { ok: true };
}
