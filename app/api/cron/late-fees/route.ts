import { NextResponse } from "next/server";
import { applyLateFees } from "@/lib/late-fees";

export const dynamic = "force-dynamic";

/**
 * Late-fee sweep. Wire to a scheduler (e.g. Vercel Cron, daily) with
 *   Authorization: Bearer ${CRON_SECRET}
 * Runs for every org that has late fees enabled; at most one fee per overdue
 * invoice per calendar month, capped at lateFeeMaxOccurrences.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { applied } = await applyLateFees();
  return NextResponse.json({ ok: true, applied });
}
