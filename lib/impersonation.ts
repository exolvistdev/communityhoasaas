import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE = "impersonation";
const MAX_AGE = 2 * 60 * 60; // 2 hours — auto-expires even if never stopped

/**
 * If the current request carries a live impersonation cookie, resolve the
 * target user/org it points at. The cookie itself carries no authority — it's
 * just an opaque id; the `ImpersonationEvent` row (still open, `endedAt: null`)
 * is what's actually trusted.
 */
export async function resolveImpersonation() {
  const eventId = cookies().get(COOKIE)?.value;
  if (!eventId) return null;

  const event = await prisma.impersonationEvent.findFirst({
    where: { id: eventId, endedAt: null },
    include: { targetUser: { include: { org: true } } },
  });
  if (!event) return null;

  return { eventId: event.id, user: event.targetUser, org: event.targetUser.org };
}

/** Server-action only (mutates cookies). */
export function setImpersonationCookie(eventId: string) {
  cookies().set(COOKIE, eventId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Server-action only (mutates cookies). */
export async function clearImpersonation() {
  const eventId = cookies().get(COOKIE)?.value;
  if (eventId) {
    await prisma.impersonationEvent
      .updateMany({ where: { id: eventId, endedAt: null }, data: { endedAt: new Date() } })
      .catch(() => {});
  }
  cookies().delete(COOKIE);
}
