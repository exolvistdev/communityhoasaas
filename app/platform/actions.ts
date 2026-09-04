"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform";
import { setImpersonationCookie, clearImpersonation } from "@/lib/impersonation";

type Result = { ok: true } | { ok: false; error: string };

export async function startImpersonation(targetUserId: string): Promise<Result> {
  const { admin } = await requirePlatformAdmin();

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { org: true },
  });
  if (!target) return { ok: false, error: "User not found" };

  const event = await prisma.impersonationEvent.create({
    data: {
      platformAdminId: admin.id,
      targetUserId: target.id,
      targetOrgName: target.org.name,
    },
  });

  setImpersonationCookie(event.id);
  redirect("/"); // role-aware landing — lands in whichever shell the target uses
}

export async function stopImpersonation() {
  await clearImpersonation();
  redirect("/platform");
}

/**
 * Move an org off its trial (or just record who signed off on it) — the
 * manual "contract settled, let them back in" step. No payment processing
 * here; that happens outside the app.
 */
export async function activateOrg(orgId: string): Promise<Result> {
  const { admin } = await requirePlatformAdmin();

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { ok: false, error: "Organization not found" };

  await prisma.organization.update({
    where: { id: orgId },
    data: { status: "ACTIVE", activatedAt: new Date(), activatedById: admin.id },
  });

  revalidatePath("/platform");
  revalidatePath(`/platform/orgs/${orgId}`);
  return { ok: true };
}
