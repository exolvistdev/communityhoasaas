import { prisma } from "@/lib/prisma";
import { APP_TZ } from "@/lib/amenity";
import {
  deliver,
  esc,
  recipientSelect,
  staffRecipients,
  type Recipient,
} from "@/lib/notifications";

/** First-name-ish label for a "from" line. */
const first = (name: string) => name.split(" ")[0];

/** Back-compat wrapper — moderators are ADMIN + BOARD_MEMBER. */
async function moderators(orgId: string): Promise<Recipient[]> {
  return staffRecipients(orgId, ["ADMIN", "BOARD_MEMBER"]);
}

/* ── new marketplace message ─────────────────────────────────────────── */

export async function notifyNewMessage(conversationId: string, senderId: string) {
  const convo = await prisma.marketConversation.findUnique({
    where: { id: conversationId },
    include: {
      listing: { select: { id: true, title: true } },
      buyer: { select: { ...recipientSelect, fullName: true } },
      seller: { select: { ...recipientSelect, fullName: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!convo) return;

  const sender = convo.buyer.id === senderId ? convo.buyer : convo.seller;
  const recipient = convo.buyer.id === senderId ? convo.seller : convo.buyer;

  // Don't ping again while the recipient still has an earlier unread from this
  // sender — only the first unread message in a burst emails.
  const priorUnread = convo.messages
    .slice(0, -1)
    .some((m) => m.senderId === senderId && !m.readAt);
  if (priorUnread) return;

  if (await areUsersBlocked(sender.id, recipient.id)) return;

  const last = convo.messages[convo.messages.length - 1];
  const snippet = last ? esc(last.body.slice(0, 160)) : "";

  await deliver({
    users: [recipient],
    type: "MARKETPLACE_MESSAGE",
    title: `${first(sender.fullName)} messaged you about "${convo.listing.title}"`,
    body: last ? last.body.slice(0, 160) : undefined,
    href: `/portal/messages/${convo.id}`,
    email: {
      subject: `New message about "${convo.listing.title}"`,
      bodyHtml: `<p>About <strong>${esc(convo.listing.title)}</strong>:</p><p style="border-left:3px solid #e5e7eb;padding-left:12px;color:#6b7280">${snippet}</p>`,
      ctaHref: `/portal/messages/${convo.id}`,
      ctaLabel: "Open conversation",
    },
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

  await deliver({
    users: mods,
    type: "MARKETPLACE_LISTING_REPORTED",
    title: `Listing reported: "${listing.title}"`,
    body: "A resident reported this listing. Review it in the moderation view.",
    href: `/marketplace/${listing.id}`,
    email: {
      subject: `Marketplace listing reported: "${listing.title}"`,
      bodyHtml: `<p>A resident reported <strong>${esc(listing.title)}</strong>. Review it and the report reason in the moderation view.</p>`,
      ctaHref: `/marketplace/${listing.id}`,
      ctaLabel: "Review listing",
    },
  });
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

  await deliver({
    users: mods,
    type: "MARKETPLACE_CONVERSATION_REPORTED",
    title: "A marketplace conversation was reported",
    body: `A resident reported a thread about "${convo.listing.title}".`,
    href: `/marketplace/conversations/${convo.id}`,
    email: {
      subject: "A marketplace conversation was reported",
      bodyHtml: `<p>A resident reported a message thread about <strong>${esc(convo.listing.title)}</strong>. You can read the full thread in the moderation view.</p>`,
      ctaHref: `/marketplace/conversations/${convo.id}`,
      ctaLabel: "Read thread",
    },
  });
}

/* ── listing moderated → seller ─────────────────────────────────────── */

export async function notifyListingModerated(
  listingId: string,
  action: "removed" | "restored",
  reason?: string
) {
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: listingId },
    include: { seller: { select: recipientSelect } },
  });
  if (!listing) return;

  const removed = action === "removed";
  await deliver({
    users: [listing.seller],
    type: "MARKETPLACE_LISTING_MODERATED",
    title: removed
      ? `Your listing "${listing.title}" was taken down`
      : `Your listing "${listing.title}" was restored`,
    body: removed
      ? reason
        ? `A moderator removed it. Reason: ${reason}`
        : "A moderator removed it."
      : "It is live again.",
    href: `/portal/market/${listing.id}`,
    email: {
      subject: removed
        ? `Your listing "${listing.title}" was taken down`
        : `Your listing "${listing.title}" was restored`,
      bodyHtml: removed
        ? `<p>A moderator removed <strong>${esc(listing.title)}</strong>.</p>${reason ? `<p>Reason: ${esc(reason)}</p>` : ""}`
        : `<p><strong>${esc(listing.title)}</strong> is live again.</p>`,
      ctaHref: `/portal/market/${listing.id}`,
      ctaLabel: "View listing",
    },
  });
}

/* ── shared helpers ─────────────────────────────────────────────────── */

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

/* ── amenity bookings ───────────────────────────────────────────────── */

const bookingInclude = {
  amenity: { select: { name: true, feeNote: true } },
  requester: { select: { ...recipientSelect, fullName: true } },
} as const;

function slotText(startAt: Date, endAt: Date) {
  const day = startAt.toLocaleDateString("en-PH", {
    timeZone: APP_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const t = (d: Date) =>
    d.toLocaleTimeString("en-PH", {
      timeZone: APP_TZ,
      hour: "numeric",
      minute: "2-digit",
    });
  return `${day}, ${t(startAt)}–${t(endAt)}`;
}

export async function notifyBookingRequested(bookingId: string) {
  const booking = await prisma.amenityBooking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });
  if (!booking) return;

  const mods = await moderators(booking.orgId);
  if (mods.length === 0) return;

  const slot = slotText(booking.startAt, booking.endAt);
  await deliver({
    users: mods,
    type: "AMENITY_BOOKING_REQUESTED",
    title: `Booking request: ${booking.amenity.name}`,
    body: `${booking.requester.fullName} requested ${booking.amenity.name} for ${slot}.`,
    href: `/amenities/bookings`,
    email: {
      subject: `Amenity booking request: ${booking.amenity.name}`,
      bodyHtml: `<p><strong>${esc(booking.requester.fullName)}</strong> requested
        <strong>${esc(booking.amenity.name)}</strong> for ${esc(slot)}.</p>
        ${booking.purpose ? `<p>Purpose: ${esc(booking.purpose)}</p>` : ""}`,
      ctaHref: `/amenities/bookings`,
      ctaLabel: "Review requests",
    },
  });
}

export async function notifyBookingDecision(bookingId: string) {
  const booking = await prisma.amenityBooking.findUnique({
    where: { id: bookingId },
    include: { ...bookingInclude, invoice: { select: { amount: true } } },
  });
  if (!booking) return;

  const confirmed = booking.status === "CONFIRMED";
  const slot = slotText(booking.startAt, booking.endAt);
  const feeAmt = booking.invoice
    ? Number(booking.invoice.amount).toLocaleString("en-PH")
    : null;
  const feeLine = feeAmt
    ? `<p>A ₱${feeAmt} fee has been added to your account.${
        booking.amenity.feeNote ? ` ${esc(booking.amenity.feeNote)}` : ""
      }</p>`
    : "";

  await deliver({
    users: [booking.requester],
    type: "AMENITY_BOOKING_DECIDED",
    title: confirmed
      ? `Booking confirmed: ${booking.amenity.name}`
      : `Booking declined: ${booking.amenity.name}`,
    body: confirmed
      ? feeAmt
        ? `${slot}. A ₱${feeAmt} fee was added to your account.`
        : `${slot}.`
      : booking.decisionNote
      ? `${slot}. Reason: ${booking.decisionNote}`
      : `${slot}.`,
    href: `/portal/amenities`,
    email: {
      subject: confirmed
        ? `Booking confirmed: ${booking.amenity.name}`
        : `Booking declined: ${booking.amenity.name}`,
      bodyHtml: `<p><strong>${esc(booking.amenity.name)}</strong> — ${esc(slot)}.</p>
        ${
          confirmed
            ? feeLine
            : booking.decisionNote
            ? `<p>Reason: ${esc(booking.decisionNote)}</p>`
            : ""
        }`,
      ctaHref: `/portal/amenities`,
      ctaLabel: "View bookings",
    },
  });
}

export async function notifyBookingCancelled(
  bookingId: string,
  by: "requester" | "staff"
) {
  const booking = await prisma.amenityBooking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });
  if (!booking) return;

  const slot = slotText(booking.startAt, booking.endAt);

  if (by === "requester") {
    const mods = await moderators(booking.orgId);
    if (mods.length === 0) return;
    await deliver({
      users: mods,
      type: "AMENITY_BOOKING_CANCELLED",
      title: `Booking cancelled: ${booking.amenity.name}`,
      body: `${booking.requester.fullName} cancelled ${booking.amenity.name} for ${slot}.`,
      href: `/amenities/bookings`,
      email: {
        subject: `Booking cancelled: ${booking.amenity.name}`,
        bodyHtml: `<p><strong>${esc(booking.requester.fullName)}</strong> cancelled
          <strong>${esc(booking.amenity.name)}</strong> for ${esc(slot)}.</p>`,
        ctaHref: `/amenities/bookings`,
        ctaLabel: "Booking requests",
      },
    });
    return;
  }

  // Staff cancelled — tell the requester.
  await deliver({
    users: [booking.requester],
    type: "AMENITY_BOOKING_CANCELLED",
    title: `Booking cancelled: ${booking.amenity.name}`,
    body: booking.decisionNote
      ? `The HOA cancelled your booking for ${slot}. Reason: ${booking.decisionNote}`
      : `The HOA cancelled your booking for ${slot}.`,
    href: `/portal/amenities`,
    email: {
      subject: `Booking cancelled: ${booking.amenity.name}`,
      bodyHtml: `<p>The HOA cancelled your booking of
        <strong>${esc(booking.amenity.name)}</strong> for ${esc(slot)}.</p>
        ${booking.decisionNote ? `<p>Reason: ${esc(booking.decisionNote)}</p>` : ""}`,
      ctaHref: `/portal/amenities`,
      ctaLabel: "View bookings",
    },
  });
}
