import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import {
  VIOLATION_CATEGORY_LABEL,
  VIOLATION_STATUS_BADGE,
} from "@/lib/violation";
import { ViolationActions } from "./ViolationActions";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

export async function generateMetadata({ params }: { params: { id: string } }) {
  const v = await prisma.violation.findUnique({
    where: { id: params.id },
    select: { property: { select: { unitNumber: true } } },
  });
  return {
    title: v ? `Violation · ${v.property.unitNumber}` : "Violation · HOA SaaS",
  };
}

export default async function ViolationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("violation:manage");

  const violation = await prisma.violation.findFirst({
    where: { id: params.id, orgId: org.id },
    include: {
      property: { select: { id: true, unitNumber: true } },
      reportedBy: { select: { fullName: true } },
      fineNotices: {
        orderBy: { noticeNumber: "asc" },
        include: {
          issuedBy: { select: { fullName: true } },
          invoice: {
            select: {
              id: true,
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
  });
  if (!violation) notFound();

  const badge = VIOLATION_STATUS_BADGE[violation.status];

  const notices = violation.fineNotices.map((fn) => {
    const inv = fn.invoice;
    const paid = inv
      ? inv.allocations.reduce((s, x) => s + Number(x.amount), 0) +
        inv.creditApplications.reduce((s, x) => s + Number(x.amount), 0)
      : 0;
    const outstanding =
      inv && inv.status !== "VOID"
        ? Math.max(Number(inv.amount) - paid, 0)
        : 0;
    return { fn, outstanding, voided: inv?.status === "VOID" };
  });
  const totalOutstanding = notices.reduce((s, n) => s + n.outstanding, 0);

  return (
    <div className="space-y-6">
      <Link href="/violations" className="text-sm text-fg-muted hover:text-fg">
        ← Violations
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border bg-surface p-5">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
            {VIOLATION_CATEGORY_LABEL[violation.category]}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </h1>
          <div className="text-sm text-fg-muted">
            <Link
              href={`/properties/${violation.property.id}`}
              className="underline underline-offset-2 hover:text-fg"
            >
              {violation.property.unitNumber}
            </Link>{" "}
            · occurred {fmtDate(violation.occurredAt)}
            {violation.cureByDate
              ? ` · resolve by ${fmtDate(violation.cureByDate)}`
              : ""}
          </div>
          {violation.reportedBy && (
            <div className="text-xs text-fg-subtle">
              Logged by {violation.reportedBy.fullName}
            </div>
          )}
        </div>
        {totalOutstanding > 0.005 && (
          <div className="text-right">
            <div className="text-sm text-fg-muted">Fines outstanding</div>
            <div className="text-lg font-semibold text-warning-fg">
              {peso(totalOutstanding)}
            </div>
            <Link
              href={`/violation-letters/${violation.id}`}
              className="text-xs text-fg-muted underline underline-offset-2 hover:text-fg"
            >
              Print demand letter
            </Link>
          </div>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Description</h2>
        <p className="whitespace-pre-wrap rounded-lg border border-border bg-surface p-4 text-sm text-fg">
          {violation.description}
        </p>
        {violation.resolutionNote && (
          <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-muted">
            Resolution note: {violation.resolutionNote}
          </p>
        )}
      </section>

      {violation.photos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">
            Photos ({violation.photos.length})
          </h2>
          <div className="flex flex-wrap gap-3">
            {violation.photos.map((_, i) => (
              <a
                key={i}
                href={`/violation-photos/${violation.id}?i=${i}`}
                target="_blank"
                rel="noreferrer"
                className="block h-28 w-28 overflow-hidden rounded-lg border border-border bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/violation-photos/${violation.id}?i=${i}`}
                  alt={`Evidence ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Fine notices</h2>
        {notices.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">
            No fine served yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-fg-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Notice</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {notices.map(({ fn, outstanding, voided }) => (
                  <tr key={fn.id} className="border-t border-border">
                    <td className="px-4 py-2 text-fg">
                      #{fn.noticeNumber}
                      {fn.note ? (
                        <div className="text-xs text-fg-subtle">{fn.note}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right">{peso(Number(fn.amount))}</td>
                    <td className="px-4 py-2 text-fg-muted">{fmtDate(fn.dueDate)}</td>
                    <td className="px-4 py-2 text-fg-muted">
                      {voided
                        ? "Voided"
                        : outstanding > 0.005
                        ? `${peso(outstanding)} due`
                        : "Paid"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ViolationActions
        violationId={violation.id}
        status={violation.status}
        hasFines={notices.length > 0}
      />
    </div>
  );
}
