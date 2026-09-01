"use server";

import { redirect } from "next/navigation";
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
