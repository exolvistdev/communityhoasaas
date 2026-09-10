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

  const ownUnit = { property: { homeowners: { some: { userId } } } };

  const [
    homeowners,
    payments,
    refunds,
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
    violations,
    maintenance,
    meetingRsvps,
    resolutionBallots,
    electionBallots,
    proxies,
    trusteeTerms,
    waterReadings,
    documentsUploaded,
    ownershipTransfers,
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
    prisma.refund.findMany({
      where: { property: { homeowners: { some: { userId } } } },
      orderBy: { refundedAt: "desc" },
      select: {
        amount: true,
        method: true,
        reference: true,
        reason: true,
        refundedAt: true,
        property: { select: { unitNumber: true } },
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
    prisma.violation.findMany({
      where: ownUnit,
      orderBy: { occurredAt: "desc" },
      select: {
        category: true,
        description: true,
        status: true,
        occurredAt: true,
        cureByDate: true,
        resolvedAt: true,
        resolutionNote: true,
        photos: true,
        property: { select: { unitNumber: true } },
        fineNotices: {
          select: {
            noticeNumber: true,
            amount: true,
            issuedAt: true,
            dueDate: true,
            note: true,
          },
        },
      },
    }),
    prisma.maintenanceRequest.findMany({
      where: { OR: [{ requesterId: userId }, ownUnit] },
      orderBy: { createdAt: "desc" },
      select: {
        title: true,
        description: true,
        category: true,
        location: true,
        isCommonArea: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        photos: true,
        property: { select: { unitNumber: true } },
        // notes visible to the requester, plus any the user wrote
        comments: {
          where: { OR: [{ staffOnly: false }, { authorId: userId }] },
          orderBy: { createdAt: "asc" },
          select: { body: true, authorId: true, createdAt: true },
        },
      },
    }),
    prisma.meetingRsvp.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        response: true,
        note: true,
        createdAt: true,
        meeting: { select: { title: true, scheduledAt: true } },
      },
    }),
    prisma.ballot.findMany({
      where: { castById: userId },
      orderBy: { createdAt: "desc" },
      select: {
        choice: true,
        createdAt: true,
        vote: { select: { title: true } },
        property: { select: { unitNumber: true } },
      },
    }),
    prisma.electionBallot.findMany({
      where: { castById: userId },
      orderBy: { createdAt: "desc" },
      select: {
        abstain: true,
        createdAt: true,
        election: { select: { title: true } },
        property: { select: { unitNumber: true } },
        votes: { select: { candidate: { select: { name: true } } } },
      },
    }),
    prisma.voteProxy.findMany({
      where: {
        OR: [
          { holderUserId: userId },
          { grantedById: userId },
          { grantorProperty: { homeowners: { some: { userId } } } },
        ],
      },
      orderBy: { grantedAt: "desc" },
      select: {
        note: true,
        grantedAt: true,
        revokedAt: true,
        grantorProperty: { select: { unitNumber: true } },
        holderUser: { select: { fullName: true } },
      },
    }),
    prisma.trustee.findMany({
      where: { OR: [{ userId }, { homeowner: { userId } }] },
      orderBy: { termStart: "desc" },
      select: {
        name: true,
        position: true,
        termStart: true,
        termEnd: true,
        endedAt: true,
      },
    }),
    prisma.meterReading.findMany({
      where: { meter: { property: { homeowners: { some: { userId } } } } },
      orderBy: { period: "desc" },
      select: {
        period: true,
        readingDate: true,
        priorReading: true,
        currentReading: true,
        consumption: true,
        amount: true,
        kind: true,
        meter: { select: { property: { select: { unitNumber: true } } } },
      },
    }),
    prisma.document.findMany({
      where: { uploadedById: userId },
      orderBy: { createdAt: "desc" },
      select: {
        title: true,
        category: true,
        fileName: true,
        sizeBytes: true,
        createdAt: true,
      },
    }),
    prisma.ownershipTransfer.findMany({
      where: ownUnit,
      orderBy: { effectiveDate: "desc" },
      select: {
        previousOwnerName: true,
        newOwnerName: true,
        vacated: true,
        finalBalance: true,
        settlement: true,
        effectiveDate: true,
        note: true,
        property: { select: { unitNumber: true } },
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
      "This file is the personal data your HOA holds that is linked to your account — " +
      "billing, statements, gate passes, maintenance, violations, board voting, water " +
      "readings, marketplace activity and more. Financial records are retained as " +
      "required by Philippine tax and audit rules; other data is kept while you are a " +
      "member and for a reasonable period after.",
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
    refunds: refunds.map((r) => ({
      amount: money(r.amount),
      method: r.method,
      reference: r.reference,
      reason: r.reason,
      refundedAt: r.refundedAt,
      unit: r.property.unitNumber,
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
    ...(violations.length
      ? {
          violations: violations.map((v) => ({
            unit: v.property.unitNumber,
            category: v.category,
            description: v.description,
            status: v.status,
            occurredAt: v.occurredAt,
            cureByDate: v.cureByDate,
            resolvedAt: v.resolvedAt,
            resolutionNote: v.resolutionNote,
            photoCount: v.photos.length,
            fines: v.fineNotices.map((f) => ({
              noticeNumber: f.noticeNumber,
              amount: money(f.amount),
              issuedAt: f.issuedAt,
              dueDate: f.dueDate,
              note: f.note,
            })),
          })),
        }
      : {}),
    ...(maintenance.length
      ? {
          maintenanceRequests: maintenance.map((m) => ({
            unit: m.property?.unitNumber ?? (m.isCommonArea ? "common area" : null),
            title: m.title,
            description: m.description,
            category: m.category,
            location: m.location,
            status: m.status,
            requestedAt: m.createdAt,
            resolvedAt: m.resolvedAt,
            photoCount: m.photos.length,
            comments: m.comments.map((c) => ({
              from: c.authorId === userId ? "you" : "staff / other",
              body: c.body,
              at: c.createdAt,
            })),
          })),
        }
      : {}),
    ...(meetingRsvps.length ||
    resolutionBallots.length ||
    electionBallots.length ||
    proxies.length ||
    trusteeTerms.length
      ? {
          governance: {
            ...(meetingRsvps.length
              ? {
                  meetingRsvps: meetingRsvps.map((r) => ({
                    meeting: r.meeting.title,
                    scheduledAt: r.meeting.scheduledAt,
                    response: r.response,
                    note: r.note,
                    at: r.createdAt,
                  })),
                }
              : {}),
            ...(resolutionBallots.length
              ? {
                  resolutionVotes: resolutionBallots.map((b) => ({
                    vote: b.vote.title,
                    unit: b.property.unitNumber,
                    choice: b.choice,
                    castAt: b.createdAt,
                  })),
                }
              : {}),
            ...(electionBallots.length
              ? {
                  electionBallots: electionBallots.map((b) => ({
                    election: b.election.title,
                    unit: b.property.unitNumber,
                    abstained: b.abstain,
                    votedFor: b.votes.map((v) => v.candidate.name),
                    castAt: b.createdAt,
                  })),
                }
              : {}),
            ...(proxies.length
              ? {
                  votingProxies: proxies.map((p) => ({
                    unit: p.grantorProperty.unitNumber,
                    holder: p.holderUser.fullName,
                    note: p.note,
                    grantedAt: p.grantedAt,
                    revokedAt: p.revokedAt,
                  })),
                }
              : {}),
            ...(trusteeTerms.length
              ? {
                  boardTerms: trusteeTerms.map((t) => ({
                    name: t.name,
                    position: t.position,
                    termStart: t.termStart,
                    termEnd: t.termEnd,
                    endedAt: t.endedAt,
                  })),
                }
              : {}),
          },
        }
      : {}),
    ...(waterReadings.length
      ? {
          waterReadings: waterReadings.map((w) => ({
            unit: w.meter.property?.unitNumber ?? null,
            period: w.period,
            readingDate: w.readingDate,
            priorReading: money(w.priorReading),
            currentReading: money(w.currentReading),
            consumption: money(w.consumption),
            amount: money(w.amount),
            kind: w.kind,
          })),
        }
      : {}),
    ...(documentsUploaded.length
      ? {
          documentsYouUploaded: documentsUploaded.map((d) => ({
            title: d.title,
            category: d.category,
            fileName: d.fileName,
            sizeBytes: d.sizeBytes,
            uploadedAt: d.createdAt,
          })),
        }
      : {}),
    ...(ownershipTransfers.length
      ? {
          ownershipTransfers: ownershipTransfers.map((o) => ({
            unit: o.property.unitNumber,
            previousOwner: o.previousOwnerName,
            newOwner: o.newOwnerName,
            vacated: o.vacated,
            finalBalance: money(o.finalBalance),
            settlement: o.settlement,
            effectiveDate: o.effectiveDate,
            note: o.note,
          })),
        }
      : {}),
  };
}
