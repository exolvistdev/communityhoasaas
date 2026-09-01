"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { denyUnless } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

type Result = { ok: true } | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/marketplace");
  if (id) revalidatePath(`/marketplace/${id}`);
  revalidatePath("/portal/market");
}

async function orgListing(id: string) {
  const { org } = await getCurrentOrgContext();
  const listing = await prisma.marketplaceListing.findFirst({
    where: { id, orgId: org.id },
  });
  return listing;
}

const reasonSchema = z.string().trim().min(3, "Give a reason").max(500);

export async function removeListing(
  id: string,
  reason: unknown
): Promise<Result> {
  const denied = await denyUnless("marketplace:moderate");
  if (denied) return denied;

  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const listing = await orgListing(id);
  if (!listing) return { ok: false, error: "Listing not found" };

  await prisma.$transaction([
    prisma.marketplaceListing.update({
      where: { id },
      data: { status: "REMOVED", removedReason: parsed.data },
    }),
    prisma.listingReport.updateMany({
      where: { listingId: id, resolvedAt: null },
      data: { resolvedAt: new Date() },
    }),
  ]);

  await logAudit({
    action: "marketplace.remove",
    target: listing.title,
    detail: parsed.data,
  });
  revalidate(id);
  return { ok: true };
}

export async function restoreListing(id: string): Promise<Result> {
  const denied = await denyUnless("marketplace:moderate");
  if (denied) return denied;

  const listing = await orgListing(id);
  if (!listing) return { ok: false, error: "Listing not found" };
  if (listing.status !== "REMOVED")
    return { ok: false, error: "This listing isn't removed" };

  await prisma.marketplaceListing.update({
    where: { id },
    data: { status: "ACTIVE", removedReason: null },
  });
  await logAudit({ action: "marketplace.restore", target: listing.title });
  revalidate(id);
  return { ok: true };
}

export async function dismissReports(id: string): Promise<Result> {
  const denied = await denyUnless("marketplace:moderate");
  if (denied) return denied;

  const listing = await orgListing(id);
  if (!listing) return { ok: false, error: "Listing not found" };

  const { count } = await prisma.listingReport.updateMany({
    where: { listingId: id, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  if (count > 0)
    await logAudit({
      action: "marketplace.reports_dismiss",
      target: listing.title,
      detail: `${count} report${count === 1 ? "" : "s"}`,
    });
  revalidate(id);
  return { ok: true };
}
