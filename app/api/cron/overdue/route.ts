import { NextResponse } from "next/server";
import { generateOverdueNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Overdue-invoice sweep. Wire to a scheduler (e.g. Vercel Cron, daily) with
 *   Authorization: Bearer ${CRON_SECRET}
 * Runs for every org; deduped to at most one INVOICE_OVERDUE per user / 25 days.
 */
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const { sent } = await generateOverdueNotifications();

  // Housekeeping: clear rate-limit rows older than a day (the limiter prunes
  // active keys itself; this sweeps the tail from IPs that never came back).
  const pruned = await prisma.rateLimitHit
    .deleteMany({ where: { at: { lt: new Date(Date.now() - 24 * 60 * 60_000) } } })
    .then((r) => r.count)
    .catch(() => 0);

  return NextResponse.json({ ok: true, sent, pruned });
}
