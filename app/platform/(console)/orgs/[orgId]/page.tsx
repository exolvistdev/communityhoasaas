import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform";
import { monthlyEstimate } from "@/lib/pricing";
import { billablePropertyCount } from "@/lib/billing";
import { peso } from "@/lib/format";
import { OrgStatusBadge } from "../../OrgStatusBadge";
import { ImpersonateButton } from "./ImpersonateButton";
import { ActivateOrgButton } from "./ActivateOrgButton";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";

export default async function PlatformOrgPage({
  params,
}: {
  params: { orgId: string };
}) {
  await requirePlatformAdmin();

  const [org, billableUnits] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: params.orgId },
      include: {
        users: { orderBy: { createdAt: "asc" } },
        _count: { select: { properties: true } },
      },
    }),
    billablePropertyCount(params.orgId),
  ]);
  if (!org) notFound();

  const est = billableUnits > 0 ? monthlyEstimate(billableUnits) : null;

  const columns: ResponsiveColumn<(typeof org.users)[number]>[] = [
    {
      key: "name",
      header: "Name",
      card: "title",
      className: "font-medium text-fg",
      cell: (u) => u.fullName,
    },
    {
      key: "email",
      header: "Email",
      className: "text-fg-muted",
      cell: (u) => u.email,
    },
    {
      key: "role",
      header: "Role",
      className: "text-fg-muted",
      cell: (u) => u.role,
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: (u) =>
        u.acceptedAt ? (
          <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-fg">
            Active
          </span>
        ) : (
          <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-fg">
            Invited
          </span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      card: "action",
      cell: (u) =>
        u.acceptedAt ? (
          <ImpersonateButton userId={u.id} userName={u.fullName} />
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/platform" className="text-sm text-fg-muted hover:text-fg">
          ← Organizations
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-fg">{org.name}</h1>
          <OrgStatusBadge org={org} />
        </div>
        <p className="text-sm text-fg-muted">
          {org.subdomain} · {org._count.properties} properties
          {est
            ? ` · ${billableUnits} billable · ${peso(est.rate, {
                cents: false,
              })}/unit · about ${peso(est.total, { cents: false })}/mo`
            : " · no billable units yet"}
          {org.estimatedUnits != null &&
            ` · ${org.estimatedUnits.toLocaleString("en-PH")} at signup`}
          {org.trialEndsAt &&
            ` · trial ends ${org.trialEndsAt.toLocaleDateString("en-PH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}`}
        </p>
        {org.status !== "ACTIVE" && <ActivateOrgButton orgId={org.id} />}
      </div>

      <ResponsiveTable
        columns={columns}
        rows={org.users}
        rowKey={(u) => u.id}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-fg-subtle">
            No users yet.
          </div>
        }
      />
    </div>
  );
}
