"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePortalRole } from "@/lib/rbac";
import { validateGatePass, extractGatePassCode } from "@/lib/gatepass";

export type ScanVerdict =
  | "VALID"
  | "EXPIRED"
  | "NOT_YET_VALID"
  | "REVOKED"
  | "NOT_FOUND";

export type ScanResult = {
  code: string;
  verdict: ScanVerdict;
  visitorName?: string;
  unitNumber?: string;
  validFrom?: string;
  validUntil?: string;
  scannedAt: string;
};

const rawSchema = z.string().trim().min(1).max(300);

export async function validatePass(input: unknown): Promise<ScanResult> {
  const { user, org } = await requirePortalRole("GUARD");
  const scannedAt = new Date().toISOString();

  const parsed = rawSchema.safeParse(input);
  const code = parsed.success ? extractGatePassCode(parsed.data).slice(0, 16) : "";

  const pass = code
    ? await prisma.gatePass.findUnique({
        where: { code },
        include: {
          property: { select: { orgId: true, unitNumber: true } },
        },
      })
    : null;

  const inOrg = pass && pass.property.orgId === org.id;
  const verdict: ScanVerdict = !inOrg ? "NOT_FOUND" : validateGatePass(pass!);

  await prisma.gatePassScan.create({
    data: {
      orgId: org.id,
      gatePassId: inOrg ? pass!.id : null,
      code: code || String(input ?? ""),
      result: verdict,
      scannedById: user.id,
    },
  });

  revalidatePath("/guard");

  if (!inOrg || !pass) return { code, verdict: "NOT_FOUND", scannedAt };

  return {
    code,
    verdict,
    visitorName: pass.visitorName,
    unitNumber: pass.property.unitNumber,
    validFrom: pass.validFrom.toISOString(),
    validUntil: pass.validUntil.toISOString(),
    scannedAt,
  };
}
