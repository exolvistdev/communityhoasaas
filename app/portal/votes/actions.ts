"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { voteIsOpen } from "@/lib/vote";
import { controllableUnits } from "@/lib/votes";

type Result = { ok: true } | { ok: false; error: string };

function revalidate(voteId?: string) {
  revalidatePath("/portal/votes");
  revalidatePath("/portal", "layout");
  if (voteId) revalidatePath(`/votes/${voteId}`);
}

/* ─────────────────────────── cast a ballot ─────────────────────── */

const ballotSchema = z.object({
  propertyId: z.string().min(1),
  choice: z.enum(["YES", "NO", "ABSTAIN"]),
});

export async function castBallot(voteId: string, input: unknown): Promise<Result> {
  const parsed = ballotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { user, org } = await getHomeownerContext();
  const vote = await prisma.boardVote.findFirst({
    where: { id: voteId, orgId: org.id },
  });
  if (!vote) return { ok: false, error: "Vote not found" };
  if (!voteIsOpen(vote)) return { ok: false, error: "Voting is closed for this motion." };

  const { propertyId, choice } = parsed.data;
  const control = await controllableUnits(user.id, org.id);
  const isOwn = control.own.some((p) => p.id === propertyId);
  const proxy = control.proxy.find((p) => p.propertyId === propertyId);
  if (!isOwn && !proxy)
    return { ok: false, error: "You can't cast a ballot for that unit." };

  await prisma.ballot.upsert({
    where: { voteId_propertyId: { voteId, propertyId } },
    create: {
      voteId,
      propertyId,
      choice,
      castById: user.id,
      viaProxyForId: isOwn ? null : proxy!.proxyId,
    },
    update: {
      choice,
      castById: user.id,
      viaProxyForId: isOwn ? null : proxy!.proxyId,
    },
  });

  revalidate(voteId);
  return { ok: true };
}

/* ─────────────────────────── proxies ───────────────────────────── */

const grantSchema = z.object({
  grantorPropertyId: z.string().min(1),
  holderEmail: z.string().trim().email("Enter the member's email"),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function grantProxy(input: unknown): Promise<Result> {
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { user, org } = await getHomeownerContext();
  const d = parsed.data;

  const owns = await prisma.homeowner.findFirst({
    where: {
      userId: user.id,
      propertyId: d.grantorPropertyId,
      property: { orgId: org.id, archivedAt: null },
    },
  });
  if (!owns) return { ok: false, error: "That's not one of your units." };

  const holder = await prisma.user.findFirst({
    where: {
      orgId: org.id,
      email: d.holderEmail.toLowerCase(),
      deactivatedAt: null,
    },
    select: { id: true },
  });
  if (!holder)
    return { ok: false, error: "No member with that email — they need a portal login." };
  if (holder.id === user.id)
    return { ok: false, error: "You can't assign a proxy to yourself." };

  await prisma.$transaction([
    prisma.voteProxy.updateMany({
      where: { grantorPropertyId: d.grantorPropertyId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.voteProxy.create({
      data: {
        orgId: org.id,
        grantorPropertyId: d.grantorPropertyId,
        holderUserId: holder.id,
        grantedById: user.id,
        note: d.note || null,
      },
    }),
  ]);

  revalidate();
  return { ok: true };
}

export async function revokeProxy(proxyId: string): Promise<Result> {
  const { user, org } = await getHomeownerContext();
  const proxy = await prisma.voteProxy.findFirst({
    where: {
      id: proxyId,
      orgId: org.id,
      grantorProperty: { homeowners: { some: { userId: user.id } } },
    },
  });
  if (!proxy) return { ok: false, error: "Proxy not found" };
  if (!proxy.revokedAt)
    await prisma.voteProxy.update({
      where: { id: proxyId },
      data: { revokedAt: new Date() },
    });

  revalidate();
  return { ok: true };
}
