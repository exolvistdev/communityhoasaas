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
        <h1 className="text-lg font-semibold text-gray-900">Audit log</h1>
        <p className="text-sm text-gray-500">
          Who did what, most recent first.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          Nothing logged yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
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
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">
                    {fmt(e.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-900">{e.actorName}</td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {e.target ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">
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
