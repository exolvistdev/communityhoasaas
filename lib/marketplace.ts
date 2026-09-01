import type { ListingCategory, ListingStatus } from "@prisma/client";

// Pure helpers — safe to import from client components.

export const MARKETPLACE_BUCKET = "marketplace";

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
  ACTIVE: { label: "Active", className: "bg-green-100 text-green-800" },
  SOLD: { label: "Sold", className: "bg-gray-200 text-gray-700" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-amber-100 text-amber-800" },
  REMOVED: { label: "Removed", className: "bg-red-100 text-red-800" },
};
