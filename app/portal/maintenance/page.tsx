import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { buttonClass } from "@/components/ui/button";
import {
  MAINTENANCE_CATEGORY_LABEL,
  MAINTENANCE_STATUS_BADGE,
} from "@/lib/maintenance";

export const metadata = { title: "Maintenance · HOA SaaS" };

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

export default async function PortalMaintenancePage() {
  const { user, homeowners } = await getHomeownerContext();
  const propertyIds = homeowners.map((h) => h.propertyId);

  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      OR: [
        { requesterId: user.id },
        propertyIds.length ? { propertyId: { in: propertyIds } } : { id: "" },
      ],
    },
    include: {
      property: { select: { unitNumber: true } },
      _count: { select: { comments: { where: { staffOnly: false } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
          ← Back
        </Link>
        <Link
          href="/portal/maintenance/new"
          className={buttonClass({ className: "text-sm" })}
        >
          New request
        </Link>
      </div>
      <h1 className="text-lg font-semibold text-fg">Maintenance requests</h1>

      {requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
          You haven&apos;t filed any requests. Tap &ldquo;New request&rdquo; to
          report a repair.
        </p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => {
            const badge = MAINTENANCE_STATUS_BADGE[r.status];
            return (
              <li key={r.id}>
                <Link
                  href={`/portal/maintenance/${r.id}`}
                  className="block rounded-lg border border-border bg-surface p-4 hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-fg">{r.title}</div>
                      <div className="text-xs text-fg-muted">
                        {MAINTENANCE_CATEGORY_LABEL[r.category]} ·{" "}
                        {r.isCommonArea
                          ? "Common area"
                          : r.property?.unitNumber ?? "—"}{" "}
                        · {fmtDate(r.createdAt)}
                        {r._count.comments > 0
                          ? ` · ${r._count.comments} update${
                              r._count.comments === 1 ? "" : "s"
                            }`
                          : ""}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
