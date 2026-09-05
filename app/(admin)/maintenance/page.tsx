import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import {
  MAINTENANCE_CATEGORY_LABEL,
  MAINTENANCE_STATUS_BADGE,
  MAINTENANCE_OPEN_STATUSES,
} from "@/lib/maintenance";

export const metadata = { title: "Maintenance · HOA SaaS" };

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

const ORDER = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
] as const;

export default async function MaintenancePage() {
  const { org } = await requirePermission("maintenance:manage");

  const requests = await prisma.maintenanceRequest.findMany({
    where: { orgId: org.id },
    include: {
      property: { select: { unitNumber: true } },
      requester: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows = [...requests].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)
  );
  const openCount = rows.filter((r) =>
    MAINTENANCE_OPEN_STATUSES.includes(r.status)
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-fg">
          Maintenance{" "}
          <span className="text-fg-subtle">({openCount} open)</span>
        </h1>
        <p className="text-sm text-fg-muted">
          Repair requests from residents and common-area work orders.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          No maintenance requests yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-fg-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Request</th>
                <th className="px-4 py-2.5 font-medium">Where</th>
                <th className="px-4 py-2.5 font-medium">Assigned</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge = MAINTENANCE_STATUS_BADGE[r.status];
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/maintenance/${r.id}`}
                        className="font-medium text-fg hover:underline"
                      >
                        {r.title}
                      </Link>
                      <div className="text-xs text-fg-subtle">
                        {MAINTENANCE_CATEGORY_LABEL[r.category]}
                        {r._count.comments > 0
                          ? ` · ${r._count.comments} comment${
                              r._count.comments === 1 ? "" : "s"
                            }`
                          : ""}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {r.isCommonArea
                        ? "Common area"
                        : r.property?.unitNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {r.assignedTo?.fullName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">
                      {fmtDate(r.updatedAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
