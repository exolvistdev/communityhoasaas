"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";

/** Mark one of the caller's notifications read. No-ops if it isn't theirs. */
export async function markRead(id: string) {
  const { user } = await getCurrentOrgContext();
  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

/** Mark every unread notification for the caller read. */
export async function markAllRead() {
  const { user } = await getCurrentOrgContext();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}
