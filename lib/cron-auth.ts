import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Checks a cron request's bearer token against the given secret in constant
 * time (a plain `!==` on the raw strings leaks timing information about how
 * many leading bytes matched — the routes calling this move real money/mail,
 * so it's worth the two extra lines).
 *
 * Requires the Node.js runtime (`node:crypto`) — fine today since every
 * caller also uses Prisma, which needs Node too, but this would break with a
 * confusing crypto-import error if a route ever opted into `export const
 * runtime = "edge"`.
 */
export function cronAuthorized(req: Request, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * The full guard every cron route needs, in one call: 503 when `CRON_SECRET`
 * isn't configured, 401 when the bearer token is wrong, `null` (proceed) when
 * it's correct. Centralized so a future 4th cron route can't drift from the
 * other three by a hand-copied mistake.
 */
export function requireCronAuth(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (!cronAuthorized(req, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
