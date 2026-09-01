import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { peso } from "@/lib/format";
import {
  CATEGORY_LABEL,
  LISTING_STATUS_BADGE,
  publicPhotoUrl,
} from "@/lib/marketplace";
import { MessageSellerButton } from "./MessageSellerButton";
import { ReportListingForm } from "./ReportListingForm";
import { SellerControls } from "./SellerControls";

export const metadata = { title: "Listing · HOA SaaS" };

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });

export default async function ListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, org } = await getHomeownerContext();

  const listing = await prisma.marketplaceListing.findFirst({
    where: { id: params.id, orgId: org.id },
    include: {
      seller: {
        select: {
          id: true,
          fullName: true,
          homeowner: { select: { property: { select: { unitNumber: true } } } },
        },
      },
    },
  });
  if (!listing) notFound();

  const isSeller = listing.sellerId === user.id;
  // Only the seller sees a listing that isn't live; moderators use /marketplace.
  if (!isSeller && listing.status !== "ACTIVE") notFound();

  const [myReport, myConversation, sellerConvoCount] = await Promise.all([
    isSeller
      ? Promise.resolve(null)
      : prisma.listingReport.findUnique({
          where: {
            listingId_reporterId: { listingId: listing.id, reporterId: user.id },
          },
        }),
    isSeller
      ? Promise.resolve(null)
      : prisma.marketConversation.findUnique({
          where: {
            listingId_buyerId: { listingId: listing.id, buyerId: user.id },
          },
        }),
    isSeller
      ? prisma.marketConversation.count({ where: { listingId: listing.id } })
      : Promise.resolve(0),
  ]);

  const badge = LISTING_STATUS_BADGE[listing.status];

  return (
    <div className="space-y-4">
      <Link
        href="/portal/market"
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← Marketplace
      </Link>

      {listing.photos.length > 0 && (
        <div className="flex snap-x gap-2 overflow-x-auto">
          {listing.photos.map((p) => (
            <img
              key={p}
              src={publicPhotoUrl(p)}
              alt=""
              className="h-64 w-64 shrink-0 snap-start rounded-xl object-cover"
            />
          ))}
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold text-gray-900">{listing.title}</h1>
          {listing.status !== "ACTIVE" && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        <div className="mt-1 text-xl font-semibold text-gray-900">
          {peso(Number(listing.price), { cents: false })}
        </div>
        <div className="mt-0.5 text-xs text-gray-400">
          {CATEGORY_LABEL[listing.category]} · posted {fmtDate(listing.createdAt)}
        </div>
      </div>

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
      </div>

      {isSeller ? (
        <>
          <SellerControls listingId={listing.id} status={listing.status} />
          {sellerConvoCount > 0 && (
            <Link
              href="/portal/messages"
              className="block text-center text-sm text-gray-500 underline hover:text-gray-900"
            >
              {sellerConvoCount} conversation
              {sellerConvoCount === 1 ? "" : "s"} about this listing
            </Link>
          )}
          {listing.status === "REMOVED" && listing.removedReason && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              Removed by a moderator: {listing.removedReason}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {myConversation ? (
            <Link
              href={`/portal/messages/${myConversation.id}`}
              className="block w-full rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-gray-800"
            >
              Open your conversation
            </Link>
          ) : (
            <MessageSellerButton listingId={listing.id} />
          )}
          <ReportListingForm
            listingId={listing.id}
            alreadyReported={Boolean(myReport && !myReport.resolvedAt)}
          />
        </div>
      )}
    </div>
  );
}
