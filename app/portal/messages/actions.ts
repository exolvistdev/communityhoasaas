"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import {
  notifyNewMessage,
  notifyConversationReported,
  areUsersBlocked,
} from "@/lib/notify";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

/* ───────────────────────── start a conversation ──────────────────── */

export async function startConversation(
  listingId: string
): Promise<Result<{ conversationId: string }>> {
  const { user, org } = await getHomeownerContext();

  const listing = await prisma.marketplaceListing.findFirst({
    where: { id: listingId, orgId: org.id },
  });
  if (!listing) return { ok: false, error: "Listing not found" };
  if (listing.sellerId === user.id)
    return { ok: false, error: "This is your own listing" };
  if (listing.status !== "ACTIVE")
    return { ok: false, error: "This listing is no longer available" };
  if (await areUsersBlocked(user.id, listing.sellerId))
    return { ok: false, error: "You can't message this person" };

  const convo = await prisma.marketConversation.upsert({
    where: {
      listingId_buyerId: { listingId, buyerId: user.id },
    },
    create: {
      orgId: org.id,
      listingId,
      buyerId: user.id,
      sellerId: listing.sellerId,
    },
    update: {},
  });

  return { ok: true, conversationId: convo.id };
}

/* ─────────────────────────────── send ────────────────────────────── */

const bodySchema = z.object({
  body: z.string().trim().min(1, "Write a message").max(2000),
});

async function participantConversation(id: string, userId: string) {
  const convo = await prisma.marketConversation.findUnique({ where: { id } });
  if (!convo) return null;
  if (convo.buyerId !== userId && convo.sellerId !== userId) return null;
  return convo;
}

export async function sendMessage(
  conversationId: string,
  input: unknown
): Promise<Result> {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user } = await getHomeownerContext();
  const convo = await participantConversation(conversationId, user.id);
  if (!convo) return { ok: false, error: "Conversation not found" };
  if (convo.closedAt)
    return { ok: false, error: "A moderator closed this conversation" };

  const other = convo.buyerId === user.id ? convo.sellerId : convo.buyerId;
  if (await areUsersBlocked(user.id, other))
    return { ok: false, error: "You can't message this person" };

  await prisma.$transaction([
    prisma.marketMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        body: parsed.data.body,
      },
    }),
    prisma.marketConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  void notifyNewMessage(conversationId, user.id).catch(() => {});
  revalidatePath("/portal/messages");
  revalidatePath(`/portal/messages/${conversationId}`);
  revalidatePath("/portal");
  return { ok: true };
}

export async function markConversationRead(
  conversationId: string
): Promise<Result> {
  const { user } = await getHomeownerContext();
  const convo = await participantConversation(conversationId, user.id);
  if (!convo) return { ok: false, error: "Conversation not found" };

  await prisma.marketMessage.updateMany({
    where: {
      conversationId,
      senderId: { not: user.id },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/portal/messages");
  revalidatePath("/portal");
  return { ok: true };
}

/* ─────────────────────────── block / unblock ─────────────────────── */

export async function blockUser(otherUserId: string): Promise<Result> {
  const { user, org } = await getHomeownerContext();
  if (otherUserId === user.id)
    return { ok: false, error: "You can't block yourself" };

  const other = await prisma.user.findFirst({
    where: { id: otherUserId, orgId: org.id },
  });
  if (!other) return { ok: false, error: "Resident not found" };

  await prisma.marketplaceBlock.upsert({
    where: {
      blockerId_blockedId: { blockerId: user.id, blockedId: otherUserId },
    },
    create: { orgId: org.id, blockerId: user.id, blockedId: otherUserId },
    update: {},
  });

  revalidatePath("/portal/messages");
  revalidatePath("/account");
  return { ok: true };
}

export async function unblockUser(otherUserId: string): Promise<Result> {
  const { user } = await getHomeownerContext();
  await prisma.marketplaceBlock
    .delete({
      where: {
        blockerId_blockedId: { blockerId: user.id, blockedId: otherUserId },
      },
    })
    .catch(() => {});

  revalidatePath("/portal/messages");
  revalidatePath("/account");
  return { ok: true };
}

/* ──────────────────────── report a conversation ──────────────────── */

const reportSchema = z.object({
  reason: z.string().trim().min(5, "Tell the moderators what's wrong").max(500),
});

export async function reportConversation(
  conversationId: string,
  input: unknown
): Promise<Result> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user } = await getHomeownerContext();
  const convo = await participantConversation(conversationId, user.id);
  if (!convo) return { ok: false, error: "Conversation not found" };

  await prisma.conversationReport.upsert({
    where: {
      conversationId_reporterId: { conversationId, reporterId: user.id },
    },
    create: { conversationId, reporterId: user.id, reason: parsed.data.reason },
    update: {
      reason: parsed.data.reason,
      createdAt: new Date(),
      resolvedAt: null,
    },
  });

  void notifyConversationReported(conversationId).catch(() => {});
  revalidatePath(`/portal/messages/${conversationId}`);
  return { ok: true };
}
