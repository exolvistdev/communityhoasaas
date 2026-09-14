import { NextResponse } from "next/server";
import { sendWaterReminders } from "@/lib/water-reminders";
import { requireCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Water-reading reminder. Wire to a daily scheduler (Vercel Cron) with
 *   Authorization: Bearer ${CRON_SECRET}
 * Nudges staff of metered HOAs that are behind on readings or billing, from
 * ~day 18 of the month, once per org per month.
 */
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const { sent } = await sendWaterReminders();
  return NextResponse.json({ ok: true, sent });
}
