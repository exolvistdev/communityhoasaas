import { prisma } from "@/lib/prisma";
import { buildStatement, parseStatementRange } from "@/lib/soa";

const money = (v: unknown) => Number(v);

/**
 * Everything the HOA holds that is linked to one user account — the RA 10173
 * data-subject access / portability payload. Scoped to `orgId`; contains no
 * other user's rows except the other party's messages in threads this user
 * took part in (those are joint and belong to the conversation).
 */
export async function buildDataExport(userId: string, orgId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      acceptedAt: true,
      deactivatedAt: true,
      emailNotifications: true,
      notificationPrefs: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const [
    homeowners,
    payments,
    gatePasses,
    gateScans,
    announcements,
    listings,
    conversations,
    blocks,
    listingReports,
    conversationReports,
    amenityBookings,
    notifications,
    auditEvents,
    impersonations,
    requests,
  ] = await Promise.all([
    prisma.homeowner.findMany({
      where: { userId },
      select: {
        fullName: true,
        role: true,
        email: true,
        phone: true,
        isPrimary: true,
        createdAt: true,
        property: { select: { id: true, unitNumber: true } },
      },
    }),
    prisma.payment.findMany({
      where: { submittedById: userId },
      orderBy: { paidAt: "desc" },
      select: {
        amount: true,
        method: true,
        status: true,
        reference: true,
        note: true,
        paidAt: true,
        invoice: {
          select: { period: true, property: { select: { unitNumber: true } } },
        },
        allocations: { select: { amount: true, invoice: { select: { period: true } } } },
      },
    }),
    prisma.gatePass.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: "desc" },
      select: {
        code: true,
        visitorName: true,
        validFrom: true,
        validUntil: true,
        status: true,
        usedAt: true,
        createdAt: true,
        property: { select: { unitNumber: true } },
      },
    }),
    prisma.gatePassScan.findMany({
      where: { scannedById: userId },
      orderBy: { scannedAt: "desc" },
      take: 500,
      select: { code: true, result: true, scannedAt: true },
    }),
    prisma.announcement.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: "desc" },
      select: {
        title: true,
        body: true,
        publishedAt: true,
        createdAt: true,
      },
    }),
    prisma.marketplaceListing.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        title: true,
        description: true,
        category: true,
        price: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.marketConversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { lastMessageAt: "desc" },
      select: {
        createdAt: true,
        listing: { select: { title: true } },
        buyer: { select: { fullName: true } },
        seller: { select: { fullName: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: { body: true, senderId: true, createdAt: true },
        },
      },
    }),
    prisma.marketplaceBlock.findMany({
      where: { blockerId: userId },
      select: { createdAt: true, blocked: { select: { fullName: true } } },
    }),
    prisma.listingReport.findMany({
      where: { reporterId: userId },
      select: {
        reason: true,
        createdAt: true,
        resolvedAt: true,
        listing: { select: { title: true } },
      },
    }),
    prisma.conversationReport.findMany({
      where: { reporterId: userId },
      select: { reason: true, createdAt: true, resolvedAt: true },
    }),
    prisma.amenityBooking.findMany({
      where: { requesterId: userId },
      orderBy: { startAt: "desc" },
      select: {
        startAt: true,
        endAt: true,
        status: true,
        purpose: true,
        decisionNote: true,
        createdAt: true,
        amenity: { select: { name: true } },
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        type: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.auditEvent.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { action: true, target: true, detail: true, createdAt: true },
    }),
    prisma.impersonationEvent.findMany({
      where: { targetUserId: userId },
      orderBy: { startedAt: "desc" },
      select: { targetOrgName: true, startedAt: true, endedAt: true },
    }),
    prisma.dataRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        type: true,
        status: true,
        reason: true,
        decisionNote: true,
        handledAt: true,
        createdAt: true,
      },
    }),
  ]);

  const statements = await Promise.all(
    homeowners.map(async (h) => ({
      unitNumber: h.property.unitNumber,
      statement: await buildStatement(
        h.property.id,
        parseStatementRange({})
      ),
    }))
  );

  return {
    exportedAt: new Date().toISOString(),
    notice:
      "This file is the personal data your HOA holds that is linked to your account. " +
      "Financial records are retained as required by Philippine tax and audit rules; " +
      "other data is kept while you are a member and for a reasonable period after.",
    account: user,
    units: homeowners.map((h) => ({
      unitNumber: h.property.unitNumber,
      fullName: h.fullName,
      role: h.role,
      contactEmail: h.email,
      contactPhone: h.phone,
      isPrimaryContact: h.isPrimary,
      linkedSince: h.createdAt,
    })),
    statements,
    payments: payments.map((p) => ({
      amount: money(p.amount),
      method: p.method,
      status: p.status,
      reference: p.reference,
      note: p.note,
      paidAt: p.paidAt,
      period: p.invoice.period,
      unit: p.invoice.property.unitNumber,
      appliedTo: p.allocations.map((a) => ({
        amount: money(a.amount),
        period: a.invoice.period,
      })),
    })),
    gatePasses: gatePasses.map(({ property, ...g }) => ({
      ...g,
      unit: property.unitNumber,
    })),
    ...(gateScans.length ? { gateScans } : {}),
    ...(announcements.length ? { announcementsAuthored: announcements } : {}),
    marketplace: {
      listings: listings.map((l) => ({ ...l, price: money(l.price) })),
      conversations: conversations.map((c) => ({
        about: c.listing.title,
        between: `${c.buyer.fullName} & ${c.seller.fullName}`,
        startedAt: c.createdAt,
        messages: c.messages.map((m) => ({
          from: m.senderId === userId ? "you" : "other party",
          body: m.body,
          at: m.createdAt,
        })),
      })),
      blockedResidents: blocks.map((b) => ({
        name: b.blocked.fullName,
        blockedAt: b.createdAt,
      })),
      reportsYouFiled: [
        ...listingReports.map((r) => ({
          kind: "listing",
          about: r.listing.title,
          reason: r.reason,
          filedAt: r.createdAt,
          resolvedAt: r.resolvedAt,
        })),
        ...conversationReports.map((r) => ({
          kind: "conversation",
          reason: r.reason,
          filedAt: r.createdAt,
          resolvedAt: r.resolvedAt,
        })),
      ],
    },
    amenityBookings: amenityBookings.map((b) => ({
      amenity: b.amenity.name,
      startAt: b.startAt,
      endAt: b.endAt,
      status: b.status,
      purpose: b.purpose,
      decisionNote: b.decisionNote,
      requestedAt: b.createdAt,
    })),
    notifications,
    ...(auditEvents.length ? { adminActionsYouTook: auditEvents } : {}),
    ...(impersonations.length
      ? { supportImpersonations: impersonations }
      : {}),
    dataRequests: requests,
  };
}
