import { NextResponse } from "next/server";
import { applyLateFees } from "@/lib/late-fees";
import { requireCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Late-fee sweep. Wire to a scheduler (e.g. Vercel Cron, daily) with
 *   Authorization: Bearer ${CRON_SECRET}
 * Runs for every org that has late fees enabled; at most one fee per overdue
 * invoice per calendar month, capped at lateFeeMaxOccurrences.
 */
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const { applied } = await applyLateFees();
  return NextResponse.json({ ok: true, applied });
}
