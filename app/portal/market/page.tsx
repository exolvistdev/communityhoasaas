import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { peso } from "@/lib/format";
import {
  CATEGORY_LABEL,
  LISTING_CATEGORIES,
  isListingCategory,
  publicPhotoUrl,
} from "@/lib/marketplace";

export const metadata = { title: "Marketplace · HOA SaaS" };

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: { cat?: string; q?: string };
}) {
  const { user, org } = await getHomeownerContext();

  const cat = isListingCategory(searchParams.cat) ? searchParams.cat : null;
  const q = (searchParams.q ?? "").trim();

  const where: Prisma.MarketplaceListingWhereInput = {
    orgId: org.id,
    status: "ACTIVE",
    ...(cat ? { category: cat } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const listings = await prisma.marketplaceListing.findMany({
    where,
    orderBy: { createdAt: "desc" },
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Marketplace</h1>
        <div className="flex gap-2">
          <Link
            href="/portal/market/mine"
            className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            My listings
          </Link>
          <Link
            href="/portal/market/new"
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
          >
            Sell something
          </Link>
        </div>
      </div>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search listings"
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-gray-900"
        />
        <select
          name="cat"
          defaultValue={cat ?? ""}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-gray-900"
        >
          <option value="">All</option>
          {LISTING_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          Go
        </button>
      </form>

      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          {q || cat
            ? "Nothing matches that search."
            : "No listings yet. Be the first to sell something."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {listings.map((l) => (
            <li key={l.id}>
              <Link
                href={`/portal/market/${l.id}`}
                className="block overflow-hidden rounded-xl border border-gray-200 bg-white hover:border-gray-300"
              >
                <div className="aspect-square bg-gray-100">
                  {l.photos[0] ? (
                    <img
                      src={publicPhotoUrl(l.photos[0])}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">
                      No photo
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {l.title}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {peso(Number(l.price), { cents: false })}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-gray-400">
                    {CATEGORY_LABEL[l.category]}
                    {l.seller.homeowner?.property
                      ? ` · ${l.seller.homeowner.property.unitNumber}`
                      : ""}
                    {l.seller.id === user.id ? " · Your listing" : ""}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
