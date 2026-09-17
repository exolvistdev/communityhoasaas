import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { peso, periodLabel } from "@/lib/format";
import { ReconciliationActions } from "./ReconciliationActions";
import { PageHeader } from "@/components/PageHeader";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";

export const metadata = { title: "Reconciliation · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank transfer",
  GCASH: "GCash",
  MAYA: "Maya",
};

export default async function ReconciliationPage() {
  const { org, user } = await getCurrentOrgContext();
  const canWrite = can(user.role, "billing:write");

  const paymentInclude = {
    invoice: {
      include: { property: { select: { id: true, unitNumber: true } } },
    },
    submittedBy: { select: { fullName: true } },
    confirmedBy: { select: { fullName: true } },
  } as const;

  const [pending, recent] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: "PENDING",
        invoice: { property: { orgId: org.id } },
      },
      include: paymentInclude,
      orderBy: { paidAt: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        status: { in: ["CONFIRMED", "REJECTED"] },
        submittedById: { not: null },
        invoice: { property: { orgId: org.id } },
      },
      include: paymentInclude,
      orderBy: { confirmedAt: "desc" },
      take: 15,
    }),
  ]);

  const pendingColumns: ResponsiveColumn<(typeof pending)[number]>[] = [
    {
      key: "unit",
      header: "Unit",
      card: "title",
      className: "font-medium text-fg",
      cell: (p) => p.invoice.property.unitNumber,
    },
    {
      key: "period",
      header: "Period",
      className: "text-fg-muted",
      cell: (p) => (p.invoice.period ? periodLabel(p.invoice.period) : "—"),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (p) => peso(Number(p.amount)),
    },
    {
      key: "method",
      header: "Method / ref",
      className: "text-fg-muted",
      cell: (p) => (
        <>
          {METHOD_LABEL[p.method]}
          {p.reference ? ` · ${p.reference}` : ""}
          {p.note ? <div className="text-xs text-fg-subtle">{p.note}</div> : null}
        </>
      ),
    },
    {
      key: "submitted",
      header: "Submitted",
      className: "text-fg-muted",
      cell: (p) => (
        <>
          {fmt(p.paidAt)}
          {p.submittedBy ? (
            <div className="text-xs text-fg-subtle">{p.submittedBy.fullName}</div>
          ) : null}
        </>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      card: "action",
      cell: (p) =>
        canWrite ? (
          <ReconciliationActions id={p.id} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
  ];

  const recentColumns: ResponsiveColumn<(typeof recent)[number]>[] = [
    {
      key: "unit",
      header: "Unit",
      card: "title",
      className: "font-medium text-fg",
      cell: (p) => p.invoice.property.unitNumber,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      className: "text-fg-muted",
      cell: (p) => peso(Number(p.amount)),
    },
    {
      key: "method",
      header: "Method / ref",
      className: "text-fg-muted",
      cell: (p) => (
        <>
          {METHOD_LABEL[p.method]}
          {p.reference ? ` · ${p.reference}` : ""}
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: (p) =>
        p.status === "CONFIRMED" ? (
          <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-fg">
            Confirmed
          </span>
        ) : (
          <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger-fg">
            Rejected
          </span>
        ),
    },
    {
      key: "confirmed",
      header: "Confirmed",
      align: "right",
      className: "text-xs text-fg-subtle",
      cell: (p) => (
        <>
          {p.confirmedAt ? fmt(p.confirmedAt) : ""}
          {p.confirmedBy ? ` · ${p.confirmedBy.fullName}` : ""}
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Payments homeowners submitted from the portal, awaiting your confirmation."
      />

      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
          Nothing to reconcile. 🎉
        </div>
      ) : (
        <ResponsiveTable
          columns={pendingColumns}
          rows={pending}
          rowKey={(p) => p.id}
          rowClassName={() => "align-top"}
        />
      )}

      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-fg">
            Recently processed
          </h2>
          <ResponsiveTable
            columns={recentColumns}
            rows={recent}
            rowKey={(p) => p.id}
            hideHeader
          />
        </div>
      )}
    </div>
  );
}
