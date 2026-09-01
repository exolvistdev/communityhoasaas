import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import {
  LISTING_STATUS_BADGE,
  listingIsExpired,
  priceLabel,
  publicPhotoUrl,
} from "@/lib/marketplace";
import { RenewButton } from "./RenewButton";

export const metadata = { title: "My listings · HOA SaaS" };

const SOON_MS = 7 * 24 * 60 * 60 * 1000;

export default async function MyListingsPage() {
  const { user } = await getHomeownerContext();

  const listings = await prisma.marketplaceListing.findMany({
    where: { sellerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { conversations: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/portal/market"
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Marketplace
        </Link>
        <Link
          href="/portal/market/new"
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
        >
          Sell something
        </Link>
      </div>
      <h1 className="text-lg font-semibold text-gray-900">My listings</h1>

      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          You haven&apos;t listed anything yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {listings.map((l) => {
            const badge = LISTING_STATUS_BADGE[l.status];
            const expired = listingIsExpired(l);
            const soon =
              l.status === "ACTIVE" &&
              !expired &&
              l.expiresAt.getTime() - Date.now() < SOON_MS;
            return (
              <li key={l.id} className="flex items-center gap-3 px-3 py-3">
                <Link
                  href={`/portal/market/${l.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
                >
                  <div className="h-14 w-14 shrink-0 rounded-md bg-gray-100">
                    {l.photos[0] && (
                      <img
                        src={publicPhotoUrl(l.photos[0])}
                        alt=""
                        className="h-14 w-14 rounded-md object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {l.title}
                    </div>
                    <div className="text-xs text-gray-400">
                      {priceLabel(Number(l.price))} · {l._count.conversations} chat
                      {l._count.conversations === 1 ? "" : "s"}
                      {expired
                        ? " · expired"
                        : soon
                        ? " · expiring soon"
                        : ""}
                    </div>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {(expired || soon) && <RenewButton id={l.id} />}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      expired ? "bg-amber-100 text-amber-800" : badge.className
                    }`}
                  >
                    {expired ? "Expired" : badge.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
