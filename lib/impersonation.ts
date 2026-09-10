import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE = "impersonation";
const MAX_AGE = 2 * 60 * 60; // 2 hours — enforced server-side (below), not just the cookie

/**
 * If the current request carries a live impersonation cookie, resolve the
 * target user/org it points at.
 *
 * The cookie is an opaque event id, but the row it points at is only honoured
 * when ALL of these hold, checked here on every request:
 *   - the event is still open (`endedAt: null`)
 *   - it started within MAX_AGE (server-side TTL — a re-set cookie can't extend it)
 *   - it was opened by a PlatformAdmin whose Supabase auth id matches the
 *     *current* session (so a leaked event id is useless to anyone else, and a
 *     platform admin whose row was revoked loses impersonation immediately)
 */
export async function resolveImpersonation(authUserId: string) {
  const eventId = cookies().get(COOKIE)?.value;
  if (!eventId) return null;

  const event = await prisma.impersonationEvent.findFirst({
    where: {
      id: eventId,
      endedAt: null,
      startedAt: { gt: new Date(Date.now() - MAX_AGE * 1000) },
      platformAdmin: { authId: authUserId },
    },
    include: {
      targetUser: { include: { org: true } },
      platformAdmin: { select: { id: true, fullName: true } },
    },
  });
  if (!event) return null;

  return {
    eventId: event.id,
    user: event.targetUser,
    org: event.targetUser.org,
    realActor: event.platformAdmin, // the platform operator actually driving this
  };
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
