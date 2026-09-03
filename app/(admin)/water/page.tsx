import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { currentPeriod, periodLabel } from "@/lib/format";
import { waterMetered } from "@/lib/water";
import {
  waterConfig,
  metersWithLatest,
  previewBilling,
} from "@/lib/water-billing";
import { WaterManager } from "./WaterManager";

export const metadata = { title: "Water billing · HOA SaaS" };

export default async function WaterPage() {
  const { org } = await requirePermission("billing:write");
  if (!waterMetered(org.waterSource)) redirect("/dashboard");
  const cfg = waterConfig(org);
  const period = currentPeriod();

  const [meters, unmetered, preview] = await Promise.all([
    metersWithLatest(org.id),
    prisma.property.findMany({
      where: { orgId: org.id, archivedAt: null, waterMeter: { is: null } },
      select: { id: true, unitNumber: true },
      orderBy: { unitNumber: "asc" },
    }),
    previewBilling(org.id, period),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-fg">Water billing</h1>
        <p className="text-sm text-fg-muted">
          Enter each meter&apos;s reading for {periodLabel(period)}, then bill the
          period.
        </p>
      </div>

      {!cfg.enabled ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-fg-muted">
          Water billing is turned off. Enable it and set your rate bands in{" "}
          <Link href="/settings" className="text-brand-accent underline">
            Settings
          </Link>{" "}
          first.
        </p>
      ) : (
        <WaterManager
          period={period}
          config={{ serviceCharge: cfg.serviceCharge, bands: cfg.bands }}
          meters={meters}
          unmetered={unmetered}
          preview={preview}
        />
      )}
    </div>
  );
}
