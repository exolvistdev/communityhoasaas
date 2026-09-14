import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Best-effort client IP from a set of request headers. Pure function (takes
 * `Headers` directly, not the Next.js request-scoped `headers()`) so it's
 * unit-testable without mocking `next/headers` — see `clientIp()` below for
 * the version every real call site actually uses.
 *
 * `x-forwarded-for` is a client-appendable chain (`client, proxy1, proxy2, …`) —
 * the platform's own edge appends the connection it actually observed as the
 * *last* entry, so that's the only hop that can't be spoofed by whoever sent
 * the request. Taking the first entry (as this used to) lets an attacker set
 * an arbitrary `X-Forwarded-For` per request and get a fresh rate-limit bucket
 * every time. `x-vercel-forwarded-for`, when present, is Vercel's own
 * platform-set header and is preferred over parsing the chain at all.
 *
 * Deliberately does NOT fall back to `x-real-ip`: nothing in this app's
 * deployment (Vercel, no other reverse proxy in front) sets or strips that
 * header, so it would just be another client-suppliable value an attacker
 * could set per request to get a fresh bucket — the exact bypass this
 * function exists to close, under a different header name.
 */
export function ipFromHeaders(h: Headers): string {
  const chain = h
    .get("x-forwarded-for")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    h.get("x-vercel-forwarded-for") ||
    (chain && chain.length ? chain[chain.length - 1] : undefined) ||
    "unknown"
  );
}

export function clientIp(): string {
  return ipFromHeaders(headers());
}

type Result = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Fixed-window rate limit backed by the `rate_limit_hits` table. Keyed by
 * `<bucket>:<ip>[:<extra>]` (pass an identifier like an email as `extra` to
 * additionally bound per-account attempts from any *one* IP).
 *
 * Deliberately has no "key on `extra` alone, no IP" mode: a bucket with no IP
 * component is a hard lockout keyed purely on a value the attacker supplies
 * (an email) — for any finite threshold, an attacker who knows the target
 * account's identifier can hold it saturated indefinitely by sending one
 * request every so often, for the cost of one request every few minutes.
 * That's a *worse* problem than the distributed-IP credential stuffing such
 * a bucket would be trying to stop. If an account genuinely needs stronger
 * protection than IP-scoped throttling gives it, that's a CAPTCHA / backoff
 * / notify-don't-block design, not a rate-limit key change.
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

/**
 * The "N attempts per IP, and a tighter M per email from that IP" pattern
 * shared by every login-ish action (`signIn`, `signInPlatform`,
 * `requestPasswordReset`) — one place for it so the two checks can't drift
 * out of sync (sequential vs. parallel, or a forgotten one) across call sites
 * that all want the same shape with different numbers.
 */
export async function rateLimitByIpAndEmail(
  bucket: string,
  opts: {
    ipMax: number;
    ipWindowMs: number;
    emailMax: number;
    emailWindowMs: number;
    email: string;
  }
): Promise<Result> {
  const [byIp, byEmail] = await Promise.all([
    rateLimit(bucket, { max: opts.ipMax, windowMs: opts.ipWindowMs }),
    rateLimit(bucket, {
      max: opts.emailMax,
      windowMs: opts.emailWindowMs,
      extra: opts.email.toLowerCase(),
    }),
  ]);
  return byIp.ok ? byEmail : byIp;
}
