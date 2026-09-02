import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { peso } from "@/lib/format";
import { can } from "@/lib/permissions";
import { InvoiceStatusBadge } from "@/components/StatusBadge";
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-fg">
          Properties{" "}
          <span className="text-fg-subtle">({properties.length})</span>
        </h1>
        {canWrite && (
          <div className="flex items-center gap-2">
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
            />
          </div>
        )}
      </div>

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

      {properties.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-sm text-fg-muted">
            No properties yet. Add one above, or{" "}
            <Link href="/properties/import" className="text-fg underline">
              import a CSV
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-fg-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Homeowner</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Monthly rate
                </th>
                <th className="px-4 py-2.5 font-medium">Latest invoice</th>
                <th className="px-4 py-2.5 text-right font-medium">Statement</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-border ${
                    p.archivedAt ? "text-fg-subtle" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium">
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
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {TYPE_LABEL[p.type]}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {p.homeowners.map((h) => h.fullName).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {p.ratePlan ? (
                      p.ratePlan.name
                    ) : (
                      <span className="text-fg-subtle">Custom</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {peso(Number(p.monthlyRate))}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.invoices[0] ? (
                      <InvoiceStatusBadge status={p.invoices[0].status} />
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/statements/${p.id}`}
                      className="text-sm text-fg-muted underline underline-offset-2 hover:text-fg"
                    >
                      View
                    </Link>
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
