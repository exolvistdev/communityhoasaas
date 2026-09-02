import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export const metadata = { title: "Audit log · HOA SaaS" };

const ACTION_LABEL: Record<string, string> = {
  "invoice.generate": "Generated invoices",
  "invoice.void": "Voided invoice",
  "payment.record": "Recorded payment",
  "payment.confirm": "Confirmed payment",
  "payment.reject": "Rejected payment",
  "property.archive": "Archived property",
  "property.restore": "Restored property",
  "rateplan.create": "Created rate plan",
  "rateplan.update": "Updated rate plan",
  "rateplan.reapply": "Re-applied rate plan",
  "rateplan.delete": "Deleted rate plan",
  "settings.update": "Updated HOA settings",
  "settings.payments_update": "Updated payment settings",
  "settings.late_fees_update": "Updated late-fee settings",
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
  "document.upload": "Uploaded a document",
  "document.update": "Updated a document",
  "document.delete": "Deleted a document",
  "ledger.manual_entry": "Posted a journal entry",
  "ledger.reverse_entry": "Reversed a journal entry",
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
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
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
