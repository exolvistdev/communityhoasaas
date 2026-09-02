import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { displayUnit, unitLinkSelect } from "@/lib/homeowner";
import {
  CATEGORY_LABEL,
  LISTING_CATEGORIES,
  LISTING_SORTS,
  isListingCategory,
  listingOrderBy,
  priceLabel,
  publicPhotoUrl,
} from "@/lib/marketplace";

export const metadata = { title: "Marketplace · HOA SaaS" };

const PAGE_SIZE = 24;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: {
    cat?: string;
    q?: string;
    min?: string;
    max?: string;
    sort?: string;
    page?: string;
  };
}) {
  const { user, org } = await getHomeownerContext();

  const cat = isListingCategory(searchParams.cat) ? searchParams.cat : null;
  const q = (searchParams.q ?? "").trim();
  const min = Number(searchParams.min) || undefined;
  const max = Number(searchParams.max) || undefined;
  const sort = LISTING_SORTS.some((s) => s.value === searchParams.sort)
    ? searchParams.sort!
    : "recent";

  const where: Prisma.MarketplaceListingWhereInput = {
    orgId: org.id,
    status: "ACTIVE",
    expiresAt: { gt: new Date() },
    ...(cat ? { category: cat } : {}),
    ...(min !== undefined || max !== undefined
      ? { price: { ...(min !== undefined ? { gte: min } : {}), ...(max !== undefined ? { lte: max } : {}) } }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const total = await prisma.marketplaceListing.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), pages);

  const listings = await prisma.marketplaceListing.findMany({
    where,
    orderBy: listingOrderBy(sort),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      seller: {
        select: { id: true, fullName: true, homeowners: { select: unitLinkSelect } },
      },
    },
  });
  const qs = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (cat) s.set("cat", cat);
    if (min !== undefined) s.set("min", String(min));
    if (max !== undefined) s.set("max", String(max));
    if (sort !== "recent") s.set("sort", sort);
    if (p > 1) s.set("page", String(p));
    const str = s.toString();
    return str ? `/portal/market?${str}` : "/portal/market";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-fg">Marketplace</h1>
        <div className="flex gap-2">
          <Link
            href="/portal/market/mine"
            className="rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-surface-2"
          >
            My listings
          </Link>
          <Link
            href="/portal/market/new"
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:brightness-110"
          >
            Sell something
          </Link>
        </div>
      </div>

      <form method="get" className="space-y-2">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search listings"
            className="min-w-0 flex-1 rounded-md border border-border px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
          <button className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-fg hover:bg-surface-2">
            Go
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            name="cat"
            defaultValue={cat ?? ""}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand"
          >
            <option value="">All categories</option>
            {LISTING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand"
          >
            {LISTING_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            name="min"
            type="number"
            min="0"
            defaultValue={min ?? ""}
            placeholder="₱ min"
            className="w-20 rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
          <input
            name="max"
            type="number"
            min="0"
            defaultValue={max ?? ""}
            placeholder="₱ max"
            className="w-20 rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
        </div>
      </form>

      {listings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-fg-muted">
          {total === 0 && !(q || cat || min || max)
            ? "No listings yet. Be the first to sell something."
            : "Nothing matches that search."}
        </p>
      ) : (
        <>
          <p className="text-xs text-fg-subtle">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {(page - 1) * PAGE_SIZE + listings.length} of {total}
          </p>
          <ul className="grid grid-cols-2 gap-3">
            {listings.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/portal/market/${l.id}`}
                  className="block overflow-hidden rounded-xl border border-border bg-surface hover:border-border"
                >
                  <div className="aspect-square bg-surface-2">
                    {l.photos[0] ? (
                      <img
                        src={publicPhotoUrl(l.photos[0])}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-fg-subtle">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="truncate text-sm font-medium text-fg">
                      {l.title}
                    </div>
                    <div className="text-sm font-semibold text-fg">
                      {priceLabel(Number(l.price))}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-fg-subtle">
                      {CATEGORY_LABEL[l.category]}
                      {displayUnit(l.seller.homeowners)
                        ? ` · ${displayUnit(l.seller.homeowners)}`
                        : ""}
                      {l.seller.id === user.id ? " · Your listing" : ""}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link href={qs(page - 1)} className="text-fg-muted hover:text-fg">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-fg-subtle">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Link href={qs(page + 1)} className="text-fg-muted hover:text-fg">
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
