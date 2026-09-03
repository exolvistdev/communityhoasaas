import { prisma } from "@/lib/prisma";
import { currentPeriod, periodLabel, shiftPeriod } from "@/lib/format";
import { logSystemAudit } from "@/lib/audit";
import { deliver, staffRecipients } from "@/lib/notifications";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Nudge staff when a metered HOA is behind on water: this month's readings not
 * started, or last month's readings recorded but never billed. Runs in the back
 * third of the month; deduped to at most one nudge per org per calendar month.
 */
export async function sendWaterReminders(orgId?: string) {
  const now = new Date();
  const period = currentPeriod(now);
  const prior = shiftPeriod(period, -1);

  const orgs = await prisma.organization.findMany({
    where: {
      waterBillingEnabled: true,
      waterSource: { in: ["INTERNAL", "EXTERNAL_BULK"] },
      ...(orgId ? { id: orgId } : {}),
    },
  });

  let sent = 0;

  for (const org of orgs) {
    if (now.getDate() < 18) continue;

    const activeMeters = await prisma.waterMeter.count({
      where: { orgId: org.id, retiredAt: null, kind: { not: "COMMON" } },
    });
    if (activeMeters === 0) continue;

    const [readThisPeriod, unbilledPrior] = await Promise.all([
      prisma.meterReading.count({ where: { orgId: org.id, period } }),
      prisma.meterReading.count({
        where: {
          orgId: org.id,
          period: prior,
          invoiceId: null,
          meter: { kind: { not: "SOURCE" } },
        },
      }),
    ]);
    if (readThisPeriod > 0 && unbilledPrior === 0) continue;

    // Coarse dedupe — did we already nudge in the last 20 days?
    const recent = await prisma.notification.findFirst({
      where: {
        user: { orgId: org.id },
        type: "DUES_ISSUED",
        title: { startsWith: "Water readings due" },
        createdAt: { gte: new Date(now.getTime() - 20 * DAY) },
      },
    });
    if (recent) continue;

    const staff = await staffRecipients(org.id, ["ADMIN", "TREASURER"]);
    if (staff.length === 0) continue;

    await deliver({
      users: staff,
      type: "DUES_ISSUED",
      title: `Water readings due for ${periodLabel(period)}`,
      body:
        readThisPeriod === 0
          ? `No water readings recorded yet for ${periodLabel(period)}.`
          : `${unbilledPrior} reading${
              unbilledPrior === 1 ? "" : "s"
            } from ${periodLabel(prior)} still need billing.`,
      href: "/water",
    }).catch(() => {});

    await logSystemAudit(org.id, "water.reminder", periodLabel(period));
    sent++;
  }

  return { sent };
}
