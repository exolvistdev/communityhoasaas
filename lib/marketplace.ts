import type { ListingCategory, ListingStatus } from "@prisma/client";
import { peso } from "@/lib/format";

// Pure helpers — safe to import from client components.

export const MARKETPLACE_BUCKET = "marketplace";

/** Max photos a seller can attach to one listing. */
export const MAX_LISTING_PHOTOS = 10;

/** How long a new listing stays visible in browse before it must be renewed. */
export const LISTING_TTL_DAYS = 30;

export function listingExpiresAt(from: Date = new Date()) {
  return new Date(from.getTime() + LISTING_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** A live listing whose window has closed — hidden from browse, renewable. */
export function listingIsExpired(l: {
  status: ListingStatus;
  expiresAt: Date;
}) {
  return l.status === "ACTIVE" && l.expiresAt.getTime() < Date.now();
}

export function priceLabel(n: number) {
  return n === 0 ? "Free" : peso(n, { cents: false });
}

export const LISTING_SORTS = [
  { value: "recent", label: "Most recent" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
] as const;

export type ListingSort = (typeof LISTING_SORTS)[number]["value"];

export function listingOrderBy(sort: string | undefined) {
  if (sort === "price_asc") return { price: "asc" as const };
  if (sort === "price_desc") return { price: "desc" as const };
  return { bumpedAt: "desc" as const };
}

/** Public URL for a stored listing photo. Pure string build. */
export function publicPhotoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MARKETPLACE_BUCKET}/${path}`;
}

export const LISTING_CATEGORIES: { value: ListingCategory; label: string }[] = [
  { value: "FURNITURE", label: "Furniture" },
  { value: "APPLIANCES", label: "Appliances" },
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "HOME_GARDEN", label: "Home & garden" },
  { value: "VEHICLES", label: "Vehicles" },
  { value: "CLOTHING", label: "Clothing" },
  { value: "KIDS", label: "Kids" },
  { value: "SERVICES", label: "Services" },
  { value: "OTHER", label: "Other" },
];

export const CATEGORY_LABEL: Record<ListingCategory, string> =
  Object.fromEntries(
    LISTING_CATEGORIES.map((c) => [c.value, c.label])
  ) as Record<ListingCategory, string>;

export function isListingCategory(v: unknown): v is ListingCategory {
  return typeof v === "string" && v in CATEGORY_LABEL;
}

export const LISTING_STATUS_BADGE: Record<
  ListingStatus,
  { label: string; className: string }
> = {
  ACTIVE: { label: "Active", className: "bg-success-subtle text-success-fg ring-1 ring-inset ring-success/25" },
  SOLD: { label: "Sold", className: "bg-surface-2 text-fg-muted ring-1 ring-inset ring-border" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-warning-subtle text-warning-fg ring-1 ring-inset ring-warning/25" },
  REMOVED: { label: "Removed", className: "bg-danger-subtle text-danger-fg ring-1 ring-inset ring-danger/25" },
};
