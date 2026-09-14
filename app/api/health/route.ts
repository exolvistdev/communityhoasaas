import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";
import { createMemoryRateLimiter } from "@/lib/memory-rate-limit";

export const dynamic = "force-dynamic";

// In-memory, not the DB-backed `rateLimit()` — this endpoint exists to check
// on the DB, so a limiter that itself queries the DB adds load to every
// normal check and, worse, fails open (waves requests through) at exactly
// the moment a struggling DB makes throttling matter most. Keyed by IP (not
// a single shared counter) so one noisy caller can't 429 every other
// monitor's legitimate checks — except when `clientIp()` can't resolve one
// ("unknown"), in which case every such caller would share one bucket and
// could throttle each other; skipping the limit there is the safer failure
// mode for a public endpoint with no sensitive data to protect.
//
// This is a genuinely per-*instance* cap, not a global one: on a serverless
// platform with concurrent/cold-started instances, each one holds its own
// unshared `hits` map, so under enough concurrent load spread across N warm
// instances the *effective* ceiling is closer to `30 × N` than a hard 30/min.
// Accepted here because the alternative (the DB-backed limiter) is worse for
// this specific endpoint for the reason above — the real backstop against
// this endpoint mattering for abuse is that it returns no sensitive data and
// costs one indexed `SELECT 1`, not this limiter being airtight.
const WINDOW_MS = 60_000;
const limiter = createMemoryRateLimiter({
  max: 30,
  windowMs: WINDOW_MS,
  maxTrackedKeys: 5000,
});

/**
 * Liveness + DB-connectivity probe for uptime monitoring and post-deploy smoke
 * tests. Public (no auth, no tenancy). 200 when the database answers, 503 when
 * it doesn't.
 */
export async function GET() {
  const ip = clientIp();
  if (ip !== "unknown" && limiter.isLimited(ip)) {
    // Not tracking each key's exact reset time — the full window is a
    // simple, honest hint that stops a naive monitor from retrying
    // immediately in a tight loop against the endpoint it just got throttled by.
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(WINDOW_MS / 1000) } }
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { ok: false, db: "down", time: new Date().toISOString() },
      { status: 503 }
    );
  }
}
