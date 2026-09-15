import { NextResponse } from "next/server";
import { getCurrentOrgContext } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { buildDataExport } from "@/lib/privacy";
import { rateLimit } from "@/lib/rate-limit";
import { safeFilename } from "@/lib/download";

export const dynamic = "force-dynamic";

/** Self-service data export (RA 10173). Immediate — no staff step. */
export async function GET() {
  const { org, user } = await getCurrentOrgContext();

  const limited = await rateLimit("account-export", {
    max: 5,
    windowMs: 3600_000,
    extra: user.id,
  });
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );

  const data = await buildDataExport(user.id, org.id);
  if (!data) return new NextResponse("Not found", { status: 404 });

  await logAudit({ action: "privacy.export", target: user.fullName });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilename(`my-hoa-data-${date}.json`)}"`,
    },
  });
}
