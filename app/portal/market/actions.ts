"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { isListingCategory, listingExpiresAt } from "@/lib/marketplace";
import { notifyListingReported } from "@/lib/notify";
import {
  uploadListingPhotos,
  deleteListingPhotos,
  MAX_LISTING_PHOTOS,
} from "@/lib/storage";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const fieldsSchema = z.object({
  title: z.string().trim().min(3, "Give it a title").max(120),
  description: z.string().trim().min(10, "Add a short description").max(4000),
  category: z.string().refine(isListingCategory, "Pick a category"),
  price: z.coerce
    .number({ invalid_type_error: "Enter a price" })
    .min(0, "Price can't be negative")
    .max(100_000_000, "That price looks wrong"),
});

function photoFiles(fd: FormData): File[] {
  return fd.getAll("photos").filter((v): v is File => v instanceof File && v.size > 0);
}

function revalidate(id?: string) {
  revalidatePath("/portal/market");
  revalidatePath("/portal/market/mine");
  if (id) revalidatePath(`/portal/market/${id}`);
  revalidatePath("/marketplace");
}

/* ─────────────────────────────── create ──────────────────────────── */

export async function createListing(
  fd: FormData
): Promise<Result<{ id: string }>> {
  const parsed = fieldsSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description"),
    category: fd.get("category"),
    price: fd.get("price"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user, org } = await getHomeownerContext();
  const d = parsed.data;

  const listing = await prisma.marketplaceListing.create({
    data: {
      orgId: org.id,
      sellerId: user.id,
      title: d.title,
      description: d.description,
      category: d.category,
      price: d.price,
      photos: [],
      expiresAt: listingExpiresAt(),
    },
  });

  const paths = await uploadListingPhotos(photoFiles(fd), {
    orgId: org.id,
    listingId: listing.id,
  });
  if (paths.length)
    await prisma.marketplaceListing.update({
      where: { id: listing.id },
      data: { photos: paths },
    });

  revalidate(listing.id);
  return { ok: true, id: listing.id };
}

/* ─────────────────────────────── update ──────────────────────────── */

async function ownListing(id: string) {
  const { user, org } = await getHomeownerContext();
  const listing = await prisma.marketplaceListing.findFirst({
    where: { id, orgId: org.id },
  });
  if (!listing || listing.sellerId !== user.id) return null;
  return { listing, user, org };
}

export async function updateListing(id: string, fd: FormData): Promise<Result> {
  const owned = await ownListing(id);
  if (!owned) return { ok: false, error: "Listing not found" };

  const parsed = fieldsSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description"),
    category: fd.get("category"),
    price: fd.get("price"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const remove = fd.getAll("removePhotos").map(String).filter(Boolean);
  let photos = owned.listing.photos.filter((p) => !remove.includes(p));

  const newPaths = await uploadListingPhotos(photoFiles(fd), {
    orgId: owned.org.id,
    listingId: id,
  });
  photos = [...photos, ...newPaths].slice(0, MAX_LISTING_PHOTOS);

  await prisma.marketplaceListing.update({
    where: { id },
    data: {
      title: d.title,
      description: d.description,
      category: d.category,
      price: d.price,
      photos,
    },
  });
  if (remove.length) await deleteListingPhotos(remove);

  revalidate(id);
  return { ok: true };
}

export async function setListingStatus(
  id: string,
  status: "ACTIVE" | "SOLD" | "WITHDRAWN"
): Promise<Result> {
  const owned = await ownListing(id);
  if (!owned) return { ok: false, error: "Listing not found" };
  if (owned.listing.status === "REMOVED")
    return { ok: false, error: "This listing was removed by a moderator" };

  await prisma.marketplaceListing.update({
    where: { id },
    data: { status, soldAt: status === "SOLD" ? new Date() : null },
  });
  revalidate(id);
  return { ok: true };
}

export async function renewListing(id: string): Promise<Result> {
  const owned = await ownListing(id);
  if (!owned) return { ok: false, error: "Listing not found" };
  if (owned.listing.status !== "ACTIVE")
    return { ok: false, error: "Only active listings can be renewed" };

  const now = new Date();
  await prisma.marketplaceListing.update({
    where: { id },
    data: { expiresAt: listingExpiresAt(now), bumpedAt: now },
  });
  revalidate(id);
  return { ok: true };
}

/* ─────────────────────────────── report ──────────────────────────── */

const reportSchema = z.object({
  reason: z.string().trim().min(5, "Tell the moderators what's wrong").max(500),
});

export async function reportListing(
  id: string,
  input: unknown
): Promise<Result> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { user, org } = await getHomeownerContext();
  const listing = await prisma.marketplaceListing.findFirst({
    where: { id, orgId: org.id },
  });
  if (!listing) return { ok: false, error: "Listing not found" };
  if (listing.sellerId === user.id)
    return { ok: false, error: "You can't report your own listing" };

  await prisma.listingReport.upsert({
    where: { listingId_reporterId: { listingId: id, reporterId: user.id } },
    create: { listingId: id, reporterId: user.id, reason: parsed.data.reason },
    update: { reason: parsed.data.reason, createdAt: new Date(), resolvedAt: null },
  });

  await notifyListingReported(id).catch(() => {});
  revalidate(id);
  return { ok: true };
}
