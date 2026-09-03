import { NextResponse } from "next/server";
import { sendWaterReminders } from "@/lib/water-reminders";

export const dynamic = "force-dynamic";

/**
 * Water-reading reminder. Wire to a daily scheduler (Vercel Cron) with
 *   Authorization: Bearer ${CRON_SECRET}
 * Nudges staff of metered HOAs that are behind on readings or billing, from
 * ~day 18 of the month, once per org per month.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sent } = await sendWaterReminders();
  return NextResponse.json({ ok: true, sent });
}
