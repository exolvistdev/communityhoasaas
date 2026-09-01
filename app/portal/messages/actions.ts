"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";

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
