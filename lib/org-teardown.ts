import type { PrismaClient } from "@prisma/client";

/**
 * Delete every tenant-scoped row for an org in FK-safe order, then the org
 * itself. The single source of truth shared by `prisma/seed.ts resetDemoOrg()`
 * and `test/fixtures.ts resetTestOrg()` — so the two can never drift.
 *
 * Storage-bucket cleanup (listing / document / QR / photo objects) is NOT done
 * here — it needs the Supabase admin client and only matters for the demo org;
 * `resetDemoOrg()` handles it before calling this.
 *
 * When a new model gains an FK into an org / user / property / invoice, add its
 * `deleteMany` here in the right slot and both callers pick it up.
 */
export async function deleteOrgCascade(db: PrismaClient, orgId: string) {
  await db.document.deleteMany({ where: { orgId } });
  await db.conversationReport.deleteMany({ where: { conversation: { orgId } } });
  await db.marketMessage.deleteMany({ where: { conversation: { orgId } } });
  await db.marketConversation.deleteMany({ where: { orgId } });
  await db.listingReport.deleteMany({ where: { listing: { orgId } } });
  await db.marketplaceListing.deleteMany({ where: { orgId } });
  await db.marketplaceBlock.deleteMany({ where: { orgId } });
  await db.amenityBooking.deleteMany({ where: { orgId } });
  await db.amenity.deleteMany({ where: { orgId } });
  await db.journalLine.deleteMany({ where: { entry: { orgId } } });
  await db.journalEntry.deleteMany({ where: { orgId } });
  await db.creditApplication.deleteMany({ where: { orgId } });
  await db.paymentAllocation.deleteMany({
    where: { payment: { invoice: { property: { orgId } } } },
  });
  await db.payment.deleteMany({ where: { invoice: { property: { orgId } } } });
  await db.waterAllocationRun.deleteMany({ where: { orgId } });
  await db.meterReading.deleteMany({ where: { orgId } });
  await db.waterMeter.deleteMany({ where: { orgId } });
  await db.invoice.deleteMany({ where: { property: { orgId } } });
  await db.gatePassScan.deleteMany({ where: { orgId } });
  await db.gatePass.deleteMany({ where: { property: { orgId } } });
  await db.refund.deleteMany({ where: { orgId } });
  await db.fineNotice.deleteMany({ where: { orgId } });
  await db.violation.deleteMany({ where: { orgId } });
  await db.maintenanceComment.deleteMany({ where: { request: { orgId } } });
  await db.maintenanceRequest.deleteMany({ where: { orgId } });
  await db.ballot.deleteMany({ where: { vote: { orgId } } });
  await db.voteProxy.deleteMany({ where: { orgId } });
  await db.boardVote.deleteMany({ where: { orgId } });
  await db.meetingRsvp.deleteMany({ where: { meeting: { orgId } } });
  await db.boardMeeting.deleteMany({ where: { orgId } });
  await db.billPayment.deleteMany({ where: { bill: { orgId } } });
  await db.bill.deleteMany({ where: { orgId } });
  await db.vendor.deleteMany({ where: { orgId } });
  await db.ownershipTransfer.deleteMany({ where: { orgId } });
  await db.auditEvent.deleteMany({ where: { orgId } });
  await db.announcement.deleteMany({ where: { orgId } });
  await db.homeowner.deleteMany({ where: { property: { orgId } } });
  await db.property.deleteMany({ where: { orgId } });
  await db.ratePlan.deleteMany({ where: { orgId } });
  await db.account.deleteMany({ where: { orgId } });
  await db.notification.deleteMany({ where: { user: { orgId } } });
  await db.dataRequest.deleteMany({ where: { orgId } });
  await db.impersonationEvent.deleteMany({ where: { targetUser: { orgId } } });
  await db.user.deleteMany({ where: { orgId } });
  await db.organization.delete({ where: { id: orgId } });
}
