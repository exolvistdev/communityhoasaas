import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/** Best-effort client IP from the request headers. */
export function clientIp(): string {
  const h = headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

type Result = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Fixed-window rate limit backed by the `rate_limit_hits` table. Keyed by
 * `<bucket>:<ip>[:<extra>]` (pass an identifier like an email as `extra` to
 * bound per-account attempts too).
 *
 * **Fails open** — a limiter outage (DB down, migration pending) must never lock
 * users out of login / signup.
 */
export async function rateLimit(
  bucket: string,
  opts: { max: number; windowMs: number; extra?: string }
): Promise<Result> {
  const key = `${clientIp()}${opts.extra ? `:${opts.extra}` : ""}`;
  const since = new Date(Date.now() - opts.windowMs);

  try {
    await prisma.rateLimitHit.deleteMany({
      where: { bucket, key, at: { lt: since } },
    });
    const recent = await prisma.rateLimitHit.findMany({
      where: { bucket, key, at: { gte: since } },
      orderBy: { at: "asc" },
      select: { at: true },
    });
    if (recent.length >= opts.max) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil(
          (recent[0].at.getTime() + opts.windowMs - Date.now()) / 1000
        )
      );
      return { ok: false, retryAfterSec };
    }
    await prisma.rateLimitHit.create({ data: { bucket, key } });
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
