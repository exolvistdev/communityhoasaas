import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { peso } from "@/lib/format";
import { LISTING_STATUS_BADGE, publicPhotoUrl } from "@/lib/marketplace";

export const metadata = { title: "My listings · HOA SaaS" };

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
            return (
              <li key={l.id}>
                <Link
                  href={`/portal/market/${l.id}`}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50"
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
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {l.title}
                    </div>
                    <div className="text-xs text-gray-400">
                      {peso(Number(l.price), { cents: false })} ·{" "}
                      {l._count.conversations} chat
                      {l._count.conversations === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
