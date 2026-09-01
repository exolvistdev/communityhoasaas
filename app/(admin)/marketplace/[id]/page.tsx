import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { peso } from "@/lib/format";
import {
  CATEGORY_LABEL,
  LISTING_STATUS_BADGE,
  publicPhotoUrl,
} from "@/lib/marketplace";
import {
  RemoveListingButton,
  RestoreListingButton,
  DismissReportsButton,
} from "../ModerationButtons";

export const metadata = { title: "Listing · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function AdminListingPage({
  params,
}: {
  params: { id: string };
}) {
  const { org } = await requirePermission("marketplace:moderate");

  const listing = await prisma.marketplaceListing.findFirst({
    where: { id: params.id, orgId: org.id },
    include: {
      seller: {
        select: {
          fullName: true,
          email: true,
          homeowner: { select: { property: { select: { unitNumber: true } } } },
        },
      },
      reports: {
        orderBy: { createdAt: "desc" },
        include: { reporter: { select: { fullName: true } } },
      },
      _count: { select: { conversations: true } },
    },
  });
  if (!listing) notFound();

  const badge = LISTING_STATUS_BADGE[listing.status];
  const openReports = listing.reports.filter((r) => !r.resolvedAt);

  return (
    <div className="max-w-2xl space-y-5">
      <Link
        href="/marketplace"
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← Marketplace
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{listing.title}</h1>
          <div className="mt-0.5 text-sm text-gray-500">
            {peso(Number(listing.price), { cents: false })} ·{" "}
            {CATEGORY_LABEL[listing.category]} · posted {fmt(listing.createdAt)}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {listing.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {listing.photos.map((p) => (
            <img
              key={p}
              src={publicPhotoUrl(p)}
              alt=""
              className="h-28 w-28 rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      <p className="whitespace-pre-wrap text-sm text-gray-700">
        {listing.description}
      </p>

      <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <div className="text-gray-500">Seller</div>
        <div className="text-gray-900">
          {listing.seller.fullName}
          {listing.seller.homeowner?.property
            ? ` · ${listing.seller.homeowner.property.unitNumber}`
            : ""}
        </div>
        <div className="text-xs text-gray-400">{listing.seller.email}</div>
        <div className="mt-1 text-xs text-gray-400">
          {listing._count.conversations} buyer conversation
          {listing._count.conversations === 1 ? "" : "s"}
        </div>
      </div>

      {listing.status === "REMOVED" && listing.removedReason && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Removed: {listing.removedReason}
        </p>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Reports ({openReports.length} open)
        </h2>
        {listing.reports.length === 0 ? (
          <p className="text-sm text-gray-400">No reports.</p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
            {listing.reports.map((r) => (
              <li key={r.id} className="px-3 py-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-800">{r.reason}</span>
                  {r.resolvedAt && (
                    <span className="shrink-0 text-xs text-gray-400">
                      resolved
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-gray-400">
                  {r.reporter.fullName} · {fmt(r.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-2 border-t border-gray-200 pt-4">
        {listing.status === "REMOVED" ? (
          <RestoreListingButton id={listing.id} />
        ) : (
          <RemoveListingButton id={listing.id} />
        )}
        {openReports.length > 0 && <DismissReportsButton id={listing.id} />}
      </div>
    </div>
  );
}
