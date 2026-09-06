import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { peso } from "@/lib/format";
import { can } from "@/lib/permissions";
import { toTypeRateDefaults } from "@/lib/rate";
import { InvoiceStatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveTable, type ResponsiveColumn } from "@/components/ui/responsive-table";
import { AddPropertyForm } from "./AddPropertyForm";

export const metadata = { title: "Properties · HOA SaaS" };

const TYPE_LABEL: Record<string, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  TOWNHOUSE: "Townhouse",
};

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: { archived?: string };
}) {
  const { org, user } = await getCurrentOrgContext();
  const canWrite = can(user.role, "property:write");
  const showArchived = searchParams.archived === "1";

  const [properties, ratePlans, archivedCount] = await Promise.all([
    prisma.property.findMany({
      where: { orgId: org.id, ...(showArchived ? {} : { archivedAt: null }) },
      include: {
        ratePlan: true,
        homeowners: { orderBy: { isPrimary: "desc" } },
        invoices: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { unitNumber: "asc" },
    }),
    prisma.ratePlan.findMany({
      where: { orgId: org.id },
      orderBy: { name: "asc" },
    }),
    prisma.property.count({
      where: { orgId: org.id, archivedAt: { not: null } },
    }),
  ]);

  const columns: ResponsiveColumn<(typeof properties)[number]>[] = [
    {
      key: "unit",
      header: "Unit",
      card: "title",
      className: "font-medium",
      cell: (p) => (
        <>
          <Link
            href={`/properties/${p.id}`}
            className="text-fg hover:underline"
          >
            {p.unitNumber}
          </Link>
          {p.archivedAt && (
            <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs text-fg-muted">
              Archived
            </span>
          )}
        </>
      ),
    },
    {
      key: "type",
      header: "Type",
      className: "text-fg-muted",
      cell: (p) => TYPE_LABEL[p.type],
    },
    {
      key: "homeowner",
      header: "Homeowner",
      className: "text-fg-muted",
      cell: (p) => p.homeowners.map((h) => h.fullName).join(", ") || "—",
    },
    {
      key: "plan",
      header: "Plan",
      className: "text-fg-muted",
      cell: (p) =>
        p.ratePlan ? (
          p.ratePlan.name
        ) : (
          <span className="text-fg-subtle">Custom</span>
        ),
    },
    {
      key: "rate",
      header: "Monthly rate",
      align: "right",
      className: "tabnums",
      cell: (p) => peso(Number(p.monthlyRate)),
    },
    {
      key: "invoice",
      header: "Latest invoice",
      card: "status",
      cell: (p) =>
        p.invoices[0] ? (
          <InvoiceStatusBadge status={p.invoices[0].status} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: "statement",
      header: "Statement",
      align: "right",
      card: "action",
      cell: (p) => (
        <Link
          href={`/statements/${p.id}`}
          className="text-sm text-fg-muted underline underline-offset-2 hover:text-fg"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <>
            Properties{" "}
            <span className="text-fg-subtle">({properties.length})</span>
          </>
        }
        action={
          canWrite ? (
            <>
              <Link
                href="/properties/import"
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
              >
                Import CSV
              </Link>
              <AddPropertyForm
                ratePlans={ratePlans.map((r) => ({
                  id: r.id,
                  name: r.name,
                  monthlyRate: Number(r.monthlyRate),
                }))}
                typeDefaults={toTypeRateDefaults(org)}
              />
            </>
          ) : undefined
        }
      />

      {archivedCount > 0 && (
        <div className="text-sm">
          {showArchived ? (
            <Link href="/properties" className="text-fg-muted underline hover:text-fg">
              Hide archived
            </Link>
          ) : (
            <Link
              href="/properties?archived=1"
              className="text-fg-muted underline hover:text-fg"
            >
              Show {archivedCount} archived
            </Link>
          )}
        </div>
      )}

      <ResponsiveTable
        rows={properties}
        rowKey={(p) => p.id}
        rowClassName={(p) => (p.archivedAt ? "text-fg-subtle" : undefined)}
        columns={columns}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
            <p className="text-sm text-fg-muted">
              No properties yet. Add one above, or{" "}
              <Link href="/properties/import" className="text-fg underline">
                import a CSV
              </Link>
              .
            </p>
          </div>
        }
      />
    </div>
  );
}
