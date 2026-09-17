import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform";
import { ratePerProperty } from "@/lib/pricing";
import { BILLABLE_PROPERTY_WHERE } from "@/lib/rate";
import { peso } from "@/lib/format";
import { OrgStatusBadge } from "./OrgStatusBadge";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";

export default async function PlatformDirectoryPage() {
  await requirePlatformAdmin();

  const [orgs, billableByOrg, recentImpersonations] = await Promise.all([
    prisma.organization.findMany({
      include: { _count: { select: { properties: true, users: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.property.groupBy({
      by: ["orgId"],
      where: BILLABLE_PROPERTY_WHERE,
      _count: { _all: true },
    }),
    prisma.impersonationEvent.findMany({
      include: {
        platformAdmin: { select: { fullName: true } },
        targetUser: { select: { fullName: true, role: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 15,
    }),
  ]);

  const billable = new Map(billableByOrg.map((r) => [r.orgId, r._count._all]));

  const fmt = (d: Date) =>
    d.toLocaleString("en-PH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const orgColumns: ResponsiveColumn<(typeof orgs)[number]>[] = [
    {
      key: "name",
      header: "Name",
      card: "title",
      cell: (org) => (
        <Link href={`/platform/orgs/${org.id}`} className="font-medium text-fg hover:underline">
          {org.name}
        </Link>
      ),
    },
    {
      key: "subdomain",
      header: "Subdomain",
      className: "text-fg-muted",
      cell: (org) => org.subdomain,
    },
    {
      key: "rate",
      header: "Rate",
      className: "text-fg-muted",
      cell: (org) => {
        const n = billable.get(org.id) ?? 0;
        return n > 0 ? `${peso(ratePerProperty(n), { cents: false })}/unit` : "—";
      },
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: (org) => <OrgStatusBadge org={org} />,
    },
    {
      key: "billable",
      header: "Billable",
      align: "right",
      className: "text-fg-muted",
      cell: (org) => billable.get(org.id) ?? 0,
    },
    {
      key: "properties",
      header: "Properties",
      align: "right",
      className: "text-fg-muted",
      cell: (org) => org._count.properties,
    },
    {
      key: "users",
      header: "Users",
      align: "right",
      className: "text-fg-muted",
      cell: (org) => org._count.users,
    },
    {
      key: "created",
      header: "Created",
      className: "text-fg-muted",
      cell: (org) => fmt(org.createdAt),
    },
  ];

  const impersonationColumns: ResponsiveColumn<(typeof recentImpersonations)[number]>[] = [
    {
      key: "who",
      header: "Impersonation",
      card: "title",
      cell: (e) => (
        <>
          {e.platformAdmin.fullName} → {e.targetUser.fullName} ({e.targetUser.role})
        </>
      ),
    },
    {
      key: "org",
      header: "Org",
      className: "text-fg-subtle",
      cell: (e) => e.targetOrgName,
    },
    {
      key: "startedAt",
      header: "Started",
      className: "text-fg-subtle",
      cell: (e) => fmt(e.startedAt),
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: (e) =>
        e.endedAt ? (
          <span className="text-xs text-fg-subtle">ended</span>
        ) : (
          <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-fg">
            ongoing
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-fg">Organizations</h1>
        <p className="text-sm text-fg-muted">
          Every HOA on the platform. {orgs.length} total.
        </p>
      </div>

      <ResponsiveTable
        columns={orgColumns}
        rows={orgs}
        rowKey={(org) => org.id}
        empty={
          <div className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-fg-subtle">
            No organizations yet.
          </div>
        }
      />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-fg">
          Recent impersonations
        </h2>
        <ResponsiveTable
          columns={impersonationColumns}
          rows={recentImpersonations}
          rowKey={(e) => e.id}
          hideHeader
          empty={<p className="text-sm text-fg-subtle">None yet.</p>}
        />
      </div>
    </div>
  );
}
