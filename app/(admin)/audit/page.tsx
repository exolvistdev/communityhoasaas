import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export const metadata = { title: "Audit log · HOA SaaS" };

const ACTION_LABEL: Record<string, string> = {
  "invoice.generate": "Generated invoices",
  "invoice.void": "Voided invoice",
  "payment.record": "Recorded payment",
  "payment.confirm": "Confirmed payment",
  "payment.reject": "Rejected payment",
  "refund.issue": "Issued a refund",
  "property.archive": "Archived property",
  "property.restore": "Restored property",
  "property.ownership_transfer": "Closed out / transferred a unit",
  "rateplan.create": "Created rate plan",
  "rateplan.update": "Updated rate plan",
  "rateplan.reapply": "Re-applied rate plan",
  "rateplan.delete": "Deleted rate plan",
  "settings.update": "Updated HOA settings",
  "settings.payments_update": "Updated payment settings",
  "settings.late_fees_update": "Updated late-fee settings",
  "settings.type_rates_update": "Updated default rates by type",
  "settings.type_rates_reapply": "Re-applied a type default rate",
  "invoice.late_fee": "Applied a late fee",
  "gatepass.revoke": "Revoked gate pass",
  "announcement.delete": "Deleted announcement",
  "team.invite": "Invited team member",
  "team.role_change": "Changed member role",
  "team.remove": "Removed team member",
  "team.reset_link_sent": "Sent password-reset link",
  "marketplace.remove": "Took down listing",
  "marketplace.restore": "Restored listing",
  "marketplace.reports_dismiss": "Dismissed listing reports",
  "marketplace.conversation_close": "Closed a conversation",
  "marketplace.conversation_reopen": "Reopened a conversation",
  "marketplace.conversation_reports_dismiss": "Dismissed conversation reports",
  "amenity.create": "Added an amenity",
  "amenity.update": "Updated an amenity",
  "amenity.archive": "Archived / restored an amenity",
  "amenity.booking_approve": "Approved a booking",
  "amenity.booking_reject": "Rejected a booking",
  "amenity.booking_cancel": "Cancelled a booking",
  "homeowner.link_existing": "Linked an existing login to a unit",
  "privacy.export": "Downloaded their data",
  "privacy.deletion_requested": "Requested account deletion",
  "privacy.deletion_completed": "Completed a deletion request",
  "privacy.deletion_rejected": "Rejected a deletion request",
  "document.upload": "Uploaded a document",
  "document.update": "Updated a document",
  "document.delete": "Deleted a document",
  "ledger.manual_entry": "Posted a journal entry",
  "ledger.reverse_entry": "Reversed a journal entry",
  "violation.log": "Logged a violation",
  "violation.status": "Updated a violation's status",
  "violation.fine": "Served a fine notice",
  "violation.delete": "Deleted a violation",
  "vendor.create": "Added a vendor",
  "vendor.update": "Updated a vendor",
  "vendor.archive": "Archived / restored a vendor",
  "bill.record": "Recorded a bill",
  "bill.pay": "Paid a bill",
  "bill.void": "Voided a bill",
  "maintenance.status": "Updated a maintenance request",
  "maintenance.assign": "Assigned a maintenance request",
  "meeting.schedule": "Scheduled a board meeting",
  "meeting.update": "Updated a board meeting",
  "meeting.cancel": "Cancelled a board meeting",
  "meeting.minutes": "Published meeting minutes",
  "vote.create": "Created a vote",
  "vote.update": "Updated a vote",
  "vote.open": "Opened a vote",
  "vote.close": "Closed a vote",
  "vote.cancel": "Cancelled a vote",
  "vote.result": "Published a vote result",
  "proxy.revoke": "Revoked a voting proxy",
  "election.create": "Created a board election",
  "election.update": "Updated a board election",
  "election.open": "Opened a board election",
  "election.close": "Closed a board election",
  "election.cancel": "Cancelled a board election",
  "election.finalize": "Seated the elected trustees",
  "election.result": "Published an election result",
  "candidate.add": "Added an election candidate",
  "candidate.remove": "Removed an election candidate",
  "candidate.withdraw": "Withdrew / reinstated a candidate",
  "trustee.add": "Added a trustee",
  "trustee.update": "Updated a trustee",
  "trustee.end": "Ended a trustee's term",
  "trustee.remove": "Removed a trustee",
  "settings.elections_update": "Updated voting & election settings",
  "meter.create": "Added a water meter",
  "meter.remove": "Removed a water meter",
  "meter.replace": "Replaced a water meter",
  "meter.retire": "Retired a water meter",
  "water.reading": "Recorded water readings",
  "water.bill": "Billed water for the period",
  "water.bill_bulk": "Split the utility water bill",
  "water.adjust": "Corrected a billed water reading",
  "water.reminder": "Sent a water-reading reminder",
  "water.source_update": "Set the subdivision's water source",
  "settings.water_update": "Updated water billing settings",
};

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function AuditPage() {
  const { org } = await requireRole("ADMIN");

  const events = await prisma.auditEvent.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">Audit log</h1>
        <p className="text-sm text-fg-muted">
          Who did what, most recent first.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          Nothing logged yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-fg-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Who</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Target</th>
                <th className="px-4 py-2.5 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-4 py-2.5 text-fg-muted">
                    {fmt(e.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-fg">{e.actorName}</td>
                  <td className="px-4 py-2.5 text-fg">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {e.target ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-fg-subtle">
                    {e.detail ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
