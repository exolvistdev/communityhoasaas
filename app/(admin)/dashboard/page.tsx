import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { MetricCard } from "@/components/MetricCard";
import { InvoiceStatusBadge } from "@/components/StatusBadge";
import { peso, periodLabel, currentPeriod } from "@/lib/format";

export const metadata = { title: "Dashboard · HOA SaaS" };

export default async function DashboardPage() {
  const { org } = await getCurrentOrgContext();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    propertyCount,
    collectedAgg,
    overdueCount,
    activeGatePasses,
    properties,
  ] = await Promise.all([
    prisma.property.count({ where: { orgId: org.id, archivedAt: null } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: "CONFIRMED",
        paidAt: { gte: monthStart },
        invoice: { property: { orgId: org.id } },
      },
    }),
    prisma.invoice.count({
      where: {
        property: { orgId: org.id },
        dueDate: { lt: now },
        status: { notIn: ["PAID", "VOID"] },
      },
    }),
    prisma.gatePass.count({
      where: {
        property: { orgId: org.id },
        status: "ACTIVE",
        validUntil: { gt: now },
      },
    }),
    prisma.property.findMany({
      where: { orgId: org.id, archivedAt: null },
      include: {
        homeowners: { orderBy: { isPrimary: "desc" } },
        invoices: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { unitNumber: "asc" },
    }),
  ]);

  const collected = Number(collectedAgg._sum.amount ?? 0);

  if (propertyCount === 0) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <h1 className="text-lg font-semibold text-gray-900">No properties yet</h1>
        <p className="mt-1 text-sm text-gray-500">
          Import your property roll to start billing and tracking your HOA.
        </p>
        <Link
          href="/onboarding"
          className="mt-4 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Import properties
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <Link
          href="/properties"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Add property
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total properties" value={propertyCount} />
        <MetricCard
          label={`Collected — ${periodLabel(currentPeriod(now))}`}
          value={peso(collected)}
          tone="success"
        />
        <MetricCard
          label="Overdue invoices"
          value={overdueCount}
          tone={overdueCount > 0 ? "danger" : "neutral"}
        />
        <Link href="/gate-passes" className="rounded-lg">
          <MetricCard label="Active gate passes" value={activeGatePasses} />
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Unit</th>
              <th className="px-4 py-2.5 font-medium">Homeowner</th>
              <th className="px-4 py-2.5 text-right font-medium">Monthly rate</th>
              <th className="px-4 py-2.5 font-medium">Latest invoice</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  <Link href={`/properties/${p.id}`} className="hover:underline">
                    {p.unitNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-600">
                  {p.homeowners.map((h) => h.fullName).join(", ") || "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {peso(Number(p.monthlyRate))}
                </td>
                <td className="px-4 py-2.5">
                  {p.invoices[0] ? (
                    <span className="flex items-center gap-2">
                      <InvoiceStatusBadge status={p.invoices[0].status} />
                      <span className="text-gray-400">
                        {peso(Number(p.invoices[0].amount))}
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-400">No invoices yet</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
