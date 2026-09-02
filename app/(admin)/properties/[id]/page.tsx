import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { peso, periodLabel } from "@/lib/format";
import { effectiveStatus, amountPaid } from "@/lib/invoice";
import { can } from "@/lib/permissions";
import { toTypeRateDefaults } from "@/lib/rate";
import { effectiveGatePassStatus } from "@/lib/gatepass";
import { buildStatement, parseStatementRange } from "@/lib/soa";
import { InvoiceStatusBadge, GatePassStatusBadge } from "@/components/StatusBadge";
import { RecordPaymentButton } from "../../billing/RecordPaymentButton";
import { VoidInvoiceButton } from "../../billing/VoidInvoiceButton";
import { CreateGatePassForm } from "../../gate-passes/CreateGatePassForm";
import { RevokeGatePassButton } from "../../gate-passes/RevokeGatePassButton";
import { ArchivePropertyButton } from "./ArchivePropertyButton";
import { EditPropertyForm } from "./EditPropertyForm";
import { PeopleSection } from "./PeopleSection";

const TYPE_LABEL: Record<string, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  TOWNHOUSE: "Townhouse",
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const p = await prisma.property.findUnique({
    where: { id: params.id },
    select: { unitNumber: true },
  });
  return { title: p ? `${p.unitNumber} · HOA SaaS` : "Property · HOA SaaS" };
}

export default async function PropertyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { org, user } = await getCurrentOrgContext();
  const canWrite = can(user.role, "property:write");

  const property = await prisma.property.findFirst({
    where: { id: params.id, orgId: org.id },
    include: {
      ratePlan: true,
      homeowners: {
        include: { user: { select: { acceptedAt: true } } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      invoices: {
        include: { payments: { where: { status: "CONFIRMED" } } },
        orderBy: { createdAt: "desc" },
      },
      gatePasses: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!property) notFound();

  const [ratePlans, statement] = await Promise.all([
    prisma.ratePlan.findMany({
      where: { orgId: org.id },
      orderBy: { name: "asc" },
    }),
    buildStatement(property.id, parseStatementRange({})),
  ]);

  const balance = statement?.closingBalance ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/properties" className="text-sm text-fg-muted hover:text-fg">
          ← Properties
        </Link>
      </div>

      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
            {property.unitNumber}
            {property.archivedAt && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-muted">
                Archived
              </span>
            )}
          </h1>
          <div className="text-sm text-fg-muted">
            {TYPE_LABEL[property.type]} · {peso(Number(property.monthlyRate))}/mo
            {property.ratePlan ? (
              <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-fg-muted">
                {property.ratePlan.name}
              </span>
            ) : (
              <span className="ml-1 text-xs text-fg-subtle">custom rate</span>
            )}
          </div>
          {canWrite && (
            <div className="flex flex-wrap gap-2 pt-2">
              <ArchivePropertyButton
                id={property.id}
                archived={Boolean(property.archivedAt)}
                balance={balance}
              />
              {!property.archivedAt && (
                <Link
                  href={`/properties/${property.id}/closeout`}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
                >
                  Close out / transfer
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-fg-muted">Current balance</div>
          <div
            className={`text-lg font-semibold ${
              balance > 0 ? "text-warning-fg" : "text-fg"
            }`}
          >
            {peso(balance)}
          </div>
          <Link
            href={`/statements/${property.id}`}
            className="text-xs text-fg-muted underline underline-offset-2 hover:text-fg"
          >
            View statement
          </Link>
        </div>
      </div>

      {canWrite && (
        <EditPropertyForm
          property={{
            id: property.id,
            unitNumber: property.unitNumber,
            type: property.type,
            monthlyRate: Number(property.monthlyRate),
            ratePlanId: property.ratePlanId,
          }}
          ratePlans={ratePlans.map((r) => ({
            id: r.id,
            name: r.name,
            monthlyRate: Number(r.monthlyRate),
          }))}
          typeDefaults={toTypeRateDefaults(org)}
        />
      )}

      <PeopleSection
        propertyId={property.id}
        canWrite={canWrite}
        people={property.homeowners.map((h) => ({
          id: h.id,
          fullName: h.fullName,
          role: h.role,
          email: h.email,
          phone: h.phone,
          isPrimary: h.isPrimary,
          hasLogin: Boolean(h.userId),
          loginAccepted: Boolean(h.user?.acceptedAt),
        }))}
      />

      {/* invoices */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Invoices</h2>
        {property.invoices.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
            No invoices yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-fg-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Period</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Due</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {property.invoices.map((inv) => {
                  const display = effectiveStatus(inv);
                  const outstanding =
                    Number(inv.amount) - amountPaid(inv.payments);
                  return (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        {inv.period ? periodLabel(inv.period) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {peso(Number(inv.amount))}
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted">
                        {fmtDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <InvoiceStatusBadge status={display} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canWrite &&
                        display !== "PAID" &&
                        display !== "VOID" ? (
                          <span className="flex items-center justify-end gap-3">
                            <RecordPaymentButton
                              invoiceId={inv.id}
                              outstanding={Number(outstanding.toFixed(2))}
                            />
                            <VoidInvoiceButton invoiceId={inv.id} />
                          </span>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* gate passes */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Gate passes</h2>
          {canWrite && (
            <CreateGatePassForm
              properties={[]}
              fixedPropertyId={property.id}
              compact
            />
          )}
        </div>
        {property.gatePasses.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
            No gate passes for this property.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-fg-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Code</th>
                  <th className="px-4 py-2.5 font-medium">Visitor</th>
                  <th className="px-4 py-2.5 font-medium">Valid</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {property.gatePasses.map((gp) => {
                  const display = effectiveGatePassStatus(gp);
                  const active = display === "ACTIVE" && !gp.usedAt;
                  return (
                    <tr key={gp.id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-mono font-medium">
                        <Link
                          href={`/pass/${gp.code}`}
                          target="_blank"
                          className="text-fg underline decoration-gray-300 underline-offset-2 hover:decoration-gray-900"
                        >
                          {gp.code}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">{gp.visitorName}</td>
                      <td className="px-4 py-2.5 text-fg-muted">
                        {fmtDate(gp.validFrom)} – {fmtDate(gp.validUntil)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <GatePassStatusBadge status={display} />
                        {gp.usedAt && (
                          <span className="ml-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-muted">
                            Used {fmtDate(gp.usedAt)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canWrite && active ? (
                          <RevokeGatePassButton id={gp.id} />
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
