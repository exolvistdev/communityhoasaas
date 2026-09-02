import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { displayUnit, unitLinkSelect } from "@/lib/homeowner";
import {
  CATEGORY_LABEL,
  LISTING_STATUS_BADGE,
  listingIsExpired,
  priceLabel,
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
        select: { id: true, fullName: true, homeowners: { select: unitLinkSelect } },
      },
    },
  });
  if (!listing) notFound();

  const isSeller = listing.sellerId === user.id;

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

  // A non-seller sees a non-live listing only if they have a conversation about
  // it (so a buyer can still reference a now-sold item). Moderators use /marketplace.
  if (!isSeller && listing.status !== "ACTIVE" && !myConversation) notFound();

  const isActive = listing.status === "ACTIVE";
  const expired = listingIsExpired(listing);
  const badge = LISTING_STATUS_BADGE[listing.status];

  return (
    <div className="space-y-4">
      <Link
        href="/portal/market"
        className="text-sm text-fg-muted hover:text-fg"
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
          <h1 className="text-lg font-semibold text-fg">{listing.title}</h1>
          {expired ? (
            <span className="shrink-0 rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-fg">
              Expired
            </span>
          ) : (
            !isActive && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
              >
                {badge.label}
              </span>
            )
          )}
        </div>
        <div className="mt-1 text-xl font-semibold text-fg">
          {priceLabel(Number(listing.price))}
        </div>
        <div className="mt-0.5 text-xs text-fg-subtle">
          {CATEGORY_LABEL[listing.category]} · posted {fmtDate(listing.createdAt)}
        </div>
      </div>

      <p className="whitespace-pre-wrap text-sm text-fg">
        {listing.description}
      </p>

      <div className="rounded-lg border border-border bg-surface p-3 text-sm">
        <div className="text-fg-muted">Seller</div>
        <div className="text-fg">
          {listing.seller.fullName}
          {displayUnit(listing.seller.homeowners)
            ? ` · ${displayUnit(listing.seller.homeowners)}`
            : ""}
        </div>
      </div>

      {isSeller ? (
        <>
          <SellerControls
            listingId={listing.id}
            status={listing.status}
            expired={expired}
          />
          {sellerConvoCount > 0 && (
            <Link
              href="/portal/messages"
              className="block text-center text-sm text-fg-muted underline hover:text-fg"
            >
              {sellerConvoCount} conversation
              {sellerConvoCount === 1 ? "" : "s"} about this listing
            </Link>
          )}
          {listing.status === "REMOVED" && listing.removedReason && (
            <p className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger-fg">
              Removed by a moderator: {listing.removedReason}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {myConversation ? (
            <Link
              href={`/portal/messages/${myConversation.id}`}
              className="block w-full rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-medium text-white hover:brightness-110"
            >
              Open your conversation
            </Link>
          ) : isActive ? (
            <MessageSellerButton listingId={listing.id} />
          ) : (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-center text-sm text-fg-muted">
              This listing is no longer available.
            </p>
          )}
          {isActive && (
            <ReportListingForm
              listingId={listing.id}
              alreadyReported={Boolean(myReport && !myReport.resolvedAt)}
            />
          )}
        </div>
      )}
    </div>
  );
}
