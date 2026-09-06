import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { peso } from "@/lib/format";
import {
  VIOLATION_CATEGORY_LABEL,
  VIOLATION_STATUS_BADGE,
} from "@/lib/violation";
import { AppealButton } from "./AppealButton";

export const metadata = { title: "Violations · HOA SaaS" };

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });

export default async function PortalViolationsPage() {
  const { property } = await getHomeownerContext();

  if (!property)
    return (
      <p className="text-sm text-fg-muted">
        Your account isn&apos;t linked to a unit yet.
      </p>
    );

  const violations = await prisma.violation.findMany({
    where: { propertyId: property.id },
    include: {
      fineNotices: {
        orderBy: { noticeNumber: "asc" },
        include: {
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
    orderBy: { occurredAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-fg">Violations</h1>

      {violations.length === 0 ? (
        <p className="rounded-lg border border-success/30 bg-success-subtle p-4 text-sm text-success-fg">
          No violations on record for {property.unitNumber}. 👍
        </p>
      ) : (
        <div className="space-y-3">
          {violations.map((v) => {
            const badge = VIOLATION_STATUS_BADGE[v.status];
            return (
              <div
                key={v.id}
                className="space-y-2 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-fg">
                      {VIOLATION_CATEGORY_LABEL[v.category]}
                    </div>
                    <div className="break-words text-xs text-fg-muted">
                      Occurred {fmtDate(v.occurredAt)}
                      {v.cureByDate ? ` · resolve by ${fmtDate(v.cureByDate)}` : ""}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-sm text-fg">
                  {v.description}
                </p>

                {v.fineNotices.length > 0 && (
                  <ul className="space-y-1 border-t border-border pt-2 text-sm">
                    {v.fineNotices.map((fn) => {
                      const inv = fn.invoice;
                      const paid = inv
                        ? inv.allocations.reduce((s, x) => s + Number(x.amount), 0) +
                          inv.creditApplications.reduce(
                            (s, x) => s + Number(x.amount),
                            0
                          )
                        : 0;
                      const outstanding =
                        inv && inv.status !== "VOID"
                          ? Math.max(Number(inv.amount) - paid, 0)
                          : 0;
                      return (
                        <li
                          key={fn.id}
                          className="flex justify-between text-fg-muted"
                        >
                          <span>
                            Fine notice #{fn.noticeNumber} · due{" "}
                            {fmtDate(fn.dueDate)}
                          </span>
                          <span
                            className={
                              outstanding > 0.005 ? "text-warning-fg" : ""
                            }
                          >
                            {inv?.status === "VOID"
                              ? "Voided"
                              : outstanding > 0.005
                              ? `${peso(outstanding)} due`
                              : "Paid"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {v.status === "OPEN" && <AppealButton violationId={v.id} />}
                {v.status === "APPEALED" && v.resolutionNote && (
                  <p className="rounded-md bg-surface-2 p-2 text-xs text-fg-muted">
                    Your appeal: {v.resolutionNote}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-fg-subtle">
        Fines appear on your statement and are included in your balance due.
      </p>
    </div>
  );
}
