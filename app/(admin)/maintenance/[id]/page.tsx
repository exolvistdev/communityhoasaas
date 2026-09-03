import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { STAFF_ROLES } from "@/lib/permissions";
import {
  MAINTENANCE_CATEGORY_LABEL,
  MAINTENANCE_STATUS_BADGE,
} from "@/lib/maintenance";
import { MaintenanceTriage } from "./MaintenanceTriage";

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export async function generateMetadata({ params }: { params: { id: string } }) {
  const r = await prisma.maintenanceRequest.findUnique({
    where: { id: params.id },
    select: { title: true },
  });
  return { title: r ? `${r.title} · HOA SaaS` : "Maintenance · HOA SaaS" };
}

export default async function MaintenanceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("maintenance:manage");

  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: params.id, orgId: org.id },
    include: {
      property: { select: { id: true, unitNumber: true } },
      requester: { select: { fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
      vendor: { select: { id: true, name: true } },
      bill: { select: { id: true, description: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { fullName: true, role: true } } },
      },
    },
  });
  if (!request) notFound();

  const [staff, vendors, openBills] = await Promise.all([
    prisma.user.findMany({
      where: { orgId: org.id, role: { in: STAFF_ROLES }, deactivatedAt: null },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.vendor.findMany({
      where: { orgId: org.id, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.bill.findMany({
      where: { orgId: org.id, status: { not: "VOID" } },
      select: { id: true, description: true, vendor: { select: { name: true } } },
      orderBy: { billDate: "desc" },
      take: 50,
    }),
  ]);

  const badge = MAINTENANCE_STATUS_BADGE[request.status];

  return (
    <div className="space-y-6">
      <Link href="/maintenance" className="text-sm text-fg-muted hover:text-fg">
        ← Maintenance
      </Link>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
          {request.title}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </h1>
        <div className="mt-1 text-sm text-fg-muted">
          {MAINTENANCE_CATEGORY_LABEL[request.category]} ·{" "}
          {request.isCommonArea ? (
            "Common area"
          ) : request.property ? (
            <Link
              href={`/properties/${request.property.id}`}
              className="underline underline-offset-2 hover:text-fg"
            >
              {request.property.unitNumber}
            </Link>
          ) : (
            "—"
          )}
          {request.location ? ` · ${request.location}` : ""}
        </div>
        <div className="mt-0.5 text-xs text-fg-subtle">
          Filed by {request.requester?.fullName ?? "a former resident"} on{" "}
          {fmt(request.createdAt)}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-fg">
          {request.description}
        </p>

        {request.photos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {request.photos.map((_, i) => (
              <a
                key={i}
                href={`/maintenance-files/${request.id}?i=${i}`}
                target="_blank"
                rel="noreferrer"
                className="block h-24 w-24 overflow-hidden rounded-lg border border-border bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/maintenance-files/${request.id}?i=${i}`}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>

      <MaintenanceTriage
        requestId={request.id}
        status={request.status}
        currentAssigneeId={request.assignedTo?.id ?? ""}
        currentVendorId={request.vendor?.id ?? ""}
        currentBillId={request.bill?.id ?? ""}
        staff={staff}
        vendors={vendors}
        bills={openBills.map((b) => ({
          id: b.id,
          label: `${b.vendor.name} — ${b.description}`,
        }))}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg">Activity</h2>
        {request.comments.length === 0 ? (
          <p className="text-sm text-fg-muted">No comments yet.</p>
        ) : (
          <ul className="space-y-2">
            {request.comments.map((c) => {
              const isStaffAuthor =
                c.author && STAFF_ROLES.includes(c.author.role);
              return (
                <li
                  key={c.id}
                  className={`rounded-lg border p-3 text-sm ${
                    c.staffOnly
                      ? "border-warning/30 bg-warning-subtle"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-fg-subtle">
                    <span className="font-medium text-fg-muted">
                      {c.author?.fullName ?? "System"}
                    </span>
                    {isStaffAuthor && <span>· staff</span>}
                    {c.staffOnly && (
                      <span className="rounded bg-warning-subtle px-1 text-warning-fg">
                        internal
                      </span>
                    )}
                    <span>· {fmt(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-fg">{c.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
