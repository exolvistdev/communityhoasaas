import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { STAFF_ROLES } from "@/lib/permissions";
import {
  MAINTENANCE_CATEGORY_LABEL,
  MAINTENANCE_STATUS_BADGE,
  canTransitionMaintenance,
} from "@/lib/maintenance";
import { RequestThread } from "./RequestThread";

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function PortalMaintenanceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, homeowners } = await getHomeownerContext();
  const propertyIds = homeowners.map((h) => h.propertyId);

  const request = await prisma.maintenanceRequest.findFirst({
    where: {
      id: params.id,
      OR: [
        { requesterId: user.id },
        propertyIds.length ? { propertyId: { in: propertyIds } } : { id: "" },
      ],
    },
    include: {
      property: { select: { unitNumber: true } },
      assignedTo: { select: { fullName: true } },
      comments: {
        where: { staffOnly: false },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { fullName: true, role: true } } },
      },
    },
  });
  if (!request) notFound();

  const badge = MAINTENANCE_STATUS_BADGE[request.status];
  const isRequester = request.requesterId === user.id;
  const canCancel =
    isRequester &&
    canTransitionMaintenance(request.status, "CANCELLED", "resident");
  const canComment =
    isRequester &&
    request.status !== "CANCELLED" &&
    request.status !== "CLOSED";

  return (
    <div className="space-y-4">
      <Link
        href="/portal/maintenance"
        className="text-sm text-fg-muted hover:text-fg"
      >
        ← Requests
      </Link>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold text-fg">{request.title}</h1>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
        <div className="mt-1 text-xs text-fg-muted">
          {MAINTENANCE_CATEGORY_LABEL[request.category]} ·{" "}
          {request.isCommonArea
            ? "Common area"
            : request.property?.unitNumber ?? "—"}
          {request.location ? ` · ${request.location}` : ""} ·{" "}
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
                className="block h-20 w-20 overflow-hidden rounded-lg border border-border bg-surface-2"
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
        {request.assignedTo && (
          <p className="mt-2 text-xs text-fg-subtle">
            Handled by {request.assignedTo.fullName}
          </p>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Updates</h2>
        {request.comments.length === 0 ? (
          <p className="text-sm text-fg-muted">No updates yet.</p>
        ) : (
          <ul className="space-y-2">
            {request.comments.map((c) => {
              const staffAuthor =
                c.author && STAFF_ROLES.includes(c.author.role);
              return (
                <li
                  key={c.id}
                  className={`rounded-lg border border-border p-3 text-sm ${
                    staffAuthor ? "bg-brand-subtle" : "bg-surface"
                  }`}
                >
                  <div className="mb-1 text-xs text-fg-subtle">
                    {c.author?.fullName ?? "HOA"}
                    {staffAuthor ? " · HOA" : ""} · {fmt(c.createdAt)}
                  </div>
                  <p className="whitespace-pre-wrap text-fg">{c.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <RequestThread
        requestId={request.id}
        canComment={canComment}
        canCancel={canCancel}
      />
    </div>
  );
}
