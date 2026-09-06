import Link from "next/link";
import { ShieldQuestion } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { relativeTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { DataRequestActions } from "./DataRequestActions";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Privacy requests · HOA SaaS" };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled by resident",
};

export default async function DataRequestsPage() {
  const { org } = await requireRole("ADMIN");

  const requests = await prisma.dataRequest.findMany({
    where: { orgId: org.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          role: true,
          deactivatedAt: true,
          homeowners: {
            select: { property: { select: { id: true, unitNumber: true } } },
          },
        },
      },
      handledBy: { select: { fullName: true } },
    },
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Privacy requests"
        description="Account-deletion requests from residents (RA 10173). Handle the deletion via the resident's unit close-out, or the Team page, then mark the request done."
      />

      {pending.length === 0 ? (
        <EmptyState
          icon={ShieldQuestion}
          title="No pending requests"
          description="Deletion requests residents submit from their account page show up here."
        />
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => {
            const unit = r.user.homeowners[0]?.property;
            return (
              <li
                key={r.id}
                className="space-y-2 rounded-lg border border-warning/30 bg-warning-subtle/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-fg">
                      {r.user.fullName}
                      <span className="ml-2 text-xs font-normal text-fg-subtle">
                        {r.user.email} · {r.user.role.toLowerCase()}
                        {r.user.deactivatedAt ? " · already deactivated" : ""}
                      </span>
                    </div>
                    <div className="text-xs text-fg-subtle">
                      Requested {relativeTime(r.createdAt)}
                    </div>
                  </div>
                  {unit && (
                    <Link
                      href={`/properties/${unit.id}/closeout`}
                      className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
                    >
                      Close out {unit.unitNumber} →
                    </Link>
                  )}
                </div>
                {r.reason && (
                  <p className="text-sm text-fg-muted">
                    &ldquo;{r.reason}&rdquo;
                  </p>
                )}
                <div className="border-t border-warning/20 pt-2">
                  <DataRequestActions id={r.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {resolved.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            History
          </h2>
          <ul className="overflow-hidden rounded-lg border border-border bg-surface text-sm">
            {resolved.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 last:border-0"
              >
                <span className="text-fg">
                  {r.user.fullName}
                  <span className="ml-2 text-xs text-fg-subtle">
                    {r.type === "DELETION" ? "deletion" : "export"} ·{" "}
                    {STATUS_LABEL[r.status]}
                    {r.handledBy ? ` by ${r.handledBy.fullName}` : ""}
                  </span>
                </span>
                <span className="text-xs text-fg-subtle">
                  {r.handledAt ? relativeTime(r.handledAt) : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
