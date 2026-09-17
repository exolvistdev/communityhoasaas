import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import {
  MAINTENANCE_CATEGORY_LABEL,
  MAINTENANCE_STATUS_BADGE,
  MAINTENANCE_OPEN_STATUSES,
} from "@/lib/maintenance";
import { PageHeader } from "@/components/PageHeader";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";

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

  const columns: ResponsiveColumn<(typeof rows)[number]>[] = [
    {
      key: "request",
      header: "Request",
      card: "title",
      cell: (r) => (
        <>
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
        </>
      ),
    },
    {
      key: "where",
      header: "Where",
      className: "text-fg-muted",
      cell: (r) => (r.isCommonArea ? "Common area" : r.property?.unitNumber ?? "—"),
    },
    {
      key: "assigned",
      header: "Assigned",
      className: "text-fg-muted",
      cell: (r) => r.assignedTo?.fullName ?? "—",
    },
    {
      key: "updated",
      header: "Updated",
      className: "text-fg-muted",
      cell: (r) => fmtDate(r.updatedAt),
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: (r) => {
        const badge = MAINTENANCE_STATUS_BADGE[r.status];
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <>
            Maintenance{" "}
            <span className="text-fg-subtle">({openCount} open)</span>
          </>
        }
        description="Repair requests from residents and common-area work orders."
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          No maintenance requests yet.
        </div>
      ) : (
        <ResponsiveTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
