import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import {
  VIOLATION_CATEGORY_LABEL,
  VIOLATION_STATUS_BADGE,
} from "@/lib/violation";
import { PageHeader } from "@/components/PageHeader";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";
import { LogViolationForm } from "./LogViolationForm";

export const metadata = { title: "Violations · HOA SaaS" };

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

const ORDER = ["OPEN", "APPEALED", "CURED", "DISMISSED"] as const;

export default async function ViolationsPage() {
  const { org } = await requirePermission("violation:manage");

  const [violations, properties] = await Promise.all([
    prisma.violation.findMany({
      where: { orgId: org.id },
      include: {
        property: { select: { unitNumber: true } },
        fineNotices: {
          select: {
            amount: true,
            invoice: {
              select: {
                status: true,
                amount: true,
                allocations: {
                  where: { payment: { status: "CONFIRMED" } },
                  select: { amount: true },
                },
                creditApplications: { select: { amount: true } },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.property.findMany({
      where: { orgId: org.id, archivedAt: null },
      select: { id: true, unitNumber: true },
      orderBy: { unitNumber: "asc" },
    }),
  ]);

  const rows = violations
    .map((v) => {
      const outstanding = v.fineNotices.reduce((s, fn) => {
        const inv = fn.invoice;
        if (!inv || inv.status === "VOID") return s;
        const paid =
          inv.allocations.reduce((a, x) => a + Number(x.amount), 0) +
          inv.creditApplications.reduce((a, x) => a + Number(x.amount), 0);
        return s + Math.max(Number(inv.amount) - paid, 0);
      }, 0);
      return { v, outstanding, fineCount: v.fineNotices.length };
    })
    .sort((a, b) => ORDER.indexOf(a.v.status) - ORDER.indexOf(b.v.status));

  const openCount = rows.filter(
    (r) => r.v.status === "OPEN" || r.v.status === "APPEALED"
  ).length;

  const columns: ResponsiveColumn<(typeof rows)[number]>[] = [
    {
      key: "unit",
      header: "Unit",
      card: "title",
      className: "font-medium text-fg",
      cell: ({ v }) => v.property.unitNumber,
    },
    {
      key: "category",
      header: "Category",
      className: "text-fg-muted",
      cell: ({ v }) => VIOLATION_CATEGORY_LABEL[v.category],
    },
    {
      key: "occurred",
      header: "Occurred",
      className: "text-fg-muted",
      cell: ({ v }) => fmtDate(v.occurredAt),
    },
    {
      key: "status",
      header: "Status",
      card: "status",
      cell: ({ v }) => {
        const badge = VIOLATION_STATUS_BADGE[v.status];
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        );
      },
    },
    {
      key: "fines",
      header: "Fines outstanding",
      align: "right",
      className: "tabnums text-fg-muted",
      cell: ({ outstanding, fineCount }) =>
        fineCount === 0
          ? "—"
          : outstanding > 0.005
          ? peso(outstanding)
          : "Paid",
    },
    {
      key: "open",
      header: "",
      align: "right",
      card: "action",
      cell: ({ v }) => (
        <Link
          href={`/violations/${v.id}`}
          className="text-sm text-fg-muted underline underline-offset-2 hover:text-fg"
        >
          Open
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <>
            Violations{" "}
            <span className="text-fg-subtle">({openCount} open)</span>
          </>
        }
        description="Log a rule violation, track it to resolution, and serve a fine if needed."
        action={<LogViolationForm properties={properties} />}
      />

      <ResponsiveTable
        rows={rows}
        rowKey={({ v }) => v.id}
        columns={columns}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-fg-muted">
            No violations logged. 🎉
          </div>
        }
      />
    </div>
  );
}
