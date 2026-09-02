import Link from "next/link";
import {
  Home,
  Wallet,
  AlertTriangle,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { MetricCard } from "@/components/MetricCard";
import { InvoiceStatusBadge } from "@/components/StatusBadge";
import { buttonClass } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { peso, periodLabel, currentPeriod } from "@/lib/format";

export const metadata = { title: "Dashboard · HOA SaaS" };

export default async function DashboardPage() {
  const { org, user } = await getCurrentOrgContext();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const canModerate = can(user.role, "marketplace:moderate");
  const canAmenities = can(user.role, "amenity:manage");

  const [
    propertyCount,
    collectedAgg,
    overdueCount,
    activeGatePasses,
    properties,
    marketReports,
    pendingBookings,
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
        usedAt: null,
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
    canModerate
      ? Promise.all([
          prisma.marketplaceListing.count({
            where: { orgId: org.id, reports: { some: { resolvedAt: null } } },
          }),
          prisma.conversationReport.count({
            where: { resolvedAt: null, conversation: { orgId: org.id } },
          }),
        ]).then(([a, b]) => a + b)
      : Promise.resolve(0),
    canAmenities
      ? prisma.amenityBooking.count({
          where: { orgId: org.id, status: "PENDING", startAt: { gt: now } },
        })
      : Promise.resolve(0),
  ]);

  const collected = Number(collectedAgg._sum.amount ?? 0);

  if (propertyCount === 0) {
    return (
      <EmptyState
        icon={Home}
        title="No properties yet"
        description="Import your property roll to start billing and tracking your HOA."
        action={
          <Link href="/onboarding" className={buttonClass()}>
            Import properties
          </Link>
        }
      />
    );
  }

  const alerts = [
    canModerate && marketReports > 0
      ? {
          href: "/marketplace?f=reported",
          text: `${marketReports} marketplace item${
            marketReports === 1 ? "" : "s"
          } need review`,
        }
      : null,
    canAmenities && pendingBookings > 0
      ? {
          href: "/amenities/bookings",
          text: `${pendingBookings} amenity booking request${
            pendingBookings === 1 ? "" : "s"
          } waiting`,
        }
      : null,
  ].filter(Boolean) as { href: string; text: string }[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Dashboard</h1>
          <p className="text-sm text-fg-muted">
            {org.name} at a glance
          </p>
        </div>
        <Link href="/properties" className={buttonClass({ variant: "secondary" })}>
          Add property
        </Link>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning-subtle px-4 py-2.5 text-sm font-medium text-warning-fg transition-colors hover:border-warning/50"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{a.text}</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total properties" value={propertyCount} icon={Home} />
        <MetricCard
          label={`Collected · ${periodLabel(currentPeriod(now))}`}
          value={peso(collected)}
          icon={Wallet}
          tone="success"
        />
        <MetricCard
          label="Overdue invoices"
          value={overdueCount}
          icon={AlertTriangle}
          tone={overdueCount > 0 ? "danger" : "neutral"}
        />
        <Link href="/gate-passes">
          <MetricCard
            label="Active gate passes"
            value={activeGatePasses}
            icon={ShieldCheck}
          />
        </Link>
      </div>

      <div className="space-y-2">
        <SectionHeader
          label="Properties"
          action={
            <Link
              href="/properties"
              className="text-xs font-medium text-brand-accent hover:underline"
            >
              View all
            </Link>
          }
        />
        <Table>
          <Thead>
            <tr>
              <Th>Unit</Th>
              <Th>Homeowner</Th>
              <Th className="text-right">Monthly rate</Th>
              <Th>Latest invoice</Th>
            </tr>
          </Thead>
          <Tbody>
            {properties.map((p) => (
              <Tr key={p.id}>
                <Td className="font-medium text-fg">
                  <Link
                    href={`/properties/${p.id}`}
                    className="hover:text-brand-accent"
                  >
                    {p.unitNumber}
                  </Link>
                </Td>
                <Td>
                  {p.homeowners.map((h) => h.fullName).join(", ") || "—"}
                </Td>
                <Td className="text-right tabnums">
                  {peso(Number(p.monthlyRate))}
                </Td>
                <Td>
                  {p.invoices[0] ? (
                    <span className="flex items-center gap-2">
                      <InvoiceStatusBadge status={p.invoices[0].status} />
                      <span className="tabnums text-fg-subtle">
                        {peso(Number(p.invoices[0].amount))}
                      </span>
                    </span>
                  ) : (
                    <span className="text-fg-subtle">No invoices yet</span>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
