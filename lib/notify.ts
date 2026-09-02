import { prisma } from "@/lib/prisma";
import { sendEmail, emailShell } from "@/lib/email";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

const canEmail = (u: { email: string; emailNotifications: boolean; deactivatedAt: Date | null }) =>
  u.emailNotifications && !u.deactivatedAt;

/** First-name-ish label for a "from" line. */
const first = (name: string) => name.split(" ")[0];

/* ── new marketplace message ─────────────────────────────────────────── */

export async function notifyNewMessage(conversationId: string, senderId: string) {
  const convo = await prisma.marketConversation.findUnique({
    where: { id: conversationId },
    include: {
      listing: { select: { title: true } },
      buyer: { select: { id: true, fullName: true, email: true, emailNotifications: true, deactivatedAt: true } },
      seller: { select: { id: true, fullName: true, email: true, emailNotifications: true, deactivatedAt: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!convo) return;

  const sender = convo.buyer.id === senderId ? convo.buyer : convo.seller;
  const recipient = convo.buyer.id === senderId ? convo.seller : convo.buyer;
  if (!canEmail(recipient)) return;

  // Don't ping again while the recipient still has an earlier unread from this
  // sender — only the first unread message in a burst emails.
  const priorUnread = convo.messages
    .slice(0, -1)
    .some((m) => m.senderId === senderId && !m.readAt);
  if (priorUnread) return;

  const blocked = await areUsersBlocked(sender.id, recipient.id);
  if (blocked) return;

  const last = convo.messages[convo.messages.length - 1];
  const snippet = last ? esc(last.body.slice(0, 160)) : "";

  await sendEmail({
    to: recipient.email,
    subject: `New message about "${convo.listing.title}"`,
    html: emailShell({
      heading: `${esc(first(sender.fullName))} sent you a message`,
      bodyHtml: `<p>About <strong>${esc(convo.listing.title)}</strong>:</p><p style="border-left:3px solid #e5e7eb;padding-left:12px;color:#6b7280">${snippet}</p>`,
      ctaHref: `/portal/messages/${convo.id}`,
      ctaLabel: "Open conversation",
    }),
  });
}

/* ── listing reported → moderators ───────────────────────────────────── */

export async function notifyListingReported(listingId: string) {
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: listingId },
    select: { id: true, orgId: true, title: true },
  });
  if (!listing) return;

  const mods = await moderators(listing.orgId);
  if (mods.length === 0) return;

  const subject = `Marketplace listing reported: "${listing.title}"`;
  const html = emailShell({
    heading: "A listing was reported",
    bodyHtml: `<p>A resident reported <strong>${esc(listing.title)}</strong>. Review it and the report reason in the moderation view.</p>`,
    ctaHref: `/marketplace/${listing.id}`,
    ctaLabel: "Review listing",
  });
  await Promise.all(mods.map((m) => sendEmail({ to: m.email, subject, html })));
}

/* ── conversation reported → moderators ──────────────────────────────── */

export async function notifyConversationReported(conversationId: string) {
  const convo = await prisma.marketConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, orgId: true, listing: { select: { title: true } } },
  });
  if (!convo) return;

  const mods = await moderators(convo.orgId);
  if (mods.length === 0) return;

  const subject = "A marketplace conversation was reported";
  const html = emailShell({
    heading: "A conversation was reported",
    bodyHtml: `<p>A resident reported a message thread about <strong>${esc(convo.listing.title)}</strong>. You can read the full thread in the moderation view.</p>`,
    ctaHref: `/marketplace/conversations/${convo.id}`,
    ctaLabel: "Read thread",
  });
  await Promise.all(mods.map((m) => sendEmail({ to: m.email, subject, html })));
}

/* ── listing moderated → seller ─────────────────────────────────────── */

export async function notifyListingModerated(
  listingId: string,
  action: "removed" | "restored",
  reason?: string
) {
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: listingId },
    include: {
      seller: { select: { email: true, emailNotifications: true, deactivatedAt: true } },
    },
  });
  if (!listing || !canEmail(listing.seller)) return;

  const removed = action === "removed";
  await sendEmail({
    to: listing.seller.email,
    subject: removed
      ? `Your listing "${listing.title}" was taken down`
      : `Your listing "${listing.title}" was restored`,
    html: emailShell({
      heading: removed ? "Your listing was taken down" : "Your listing was restored",
      bodyHtml: removed
        ? `<p>A moderator removed <strong>${esc(listing.title)}</strong>.</p>${reason ? `<p>Reason: ${esc(reason)}</p>` : ""}`
        : `<p><strong>${esc(listing.title)}</strong> is live again.</p>`,
      ctaHref: `/portal/market/${listing.id}`,
      ctaLabel: "View listing",
    }),
  });
}

/* ── shared helpers ─────────────────────────────────────────────────── */

async function moderators(orgId: string) {
  return prisma.user.findMany({
    where: {
      orgId,
      role: { in: ["ADMIN", "BOARD_MEMBER"] },
      deactivatedAt: null,
      emailNotifications: true,
    },
    select: { email: true },
  });
}

export async function areUsersBlocked(aId: string, bId: string) {
  const block = await prisma.marketplaceBlock.findFirst({
    where: {
      OR: [
        { blockerId: aId, blockedId: bId },
        { blockerId: bId, blockedId: aId },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}
