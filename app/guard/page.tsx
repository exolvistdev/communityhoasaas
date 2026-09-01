import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/rbac";
import { GuardScanner } from "./GuardScanner";
import type { ScanResult } from "./actions";

export default async function GuardHome() {
  const { user, org } = await requirePortalRole("GUARD");

  const scans = await prisma.gatePassScan.findMany({
    where: { orgId: org.id, scannedById: user.id },
    include: {
      gatePass: {
        select: {
          visitorName: true,
          validFrom: true,
          validUntil: true,
          property: { select: { unitNumber: true } },
        },
      },
    },
    orderBy: { scannedAt: "desc" },
    take: 8,
  });

  const initialRecent: ScanResult[] = scans.map((s) => ({
    code: s.code,
    verdict: s.result as ScanResult["verdict"],
    visitorName: s.gatePass?.visitorName,
    unitNumber: s.gatePass?.property.unitNumber,
    validFrom: s.gatePass?.validFrom.toISOString(),
    validUntil: s.gatePass?.validUntil.toISOString(),
    scannedAt: s.scannedAt.toISOString(),
  }));

  return <GuardScanner initialRecent={initialRecent} />;
}
