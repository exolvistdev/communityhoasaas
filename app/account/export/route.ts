import { NextResponse } from "next/server";
import { getCurrentOrgContext } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { buildDataExport } from "@/lib/privacy";

export const dynamic = "force-dynamic";

/** Self-service data export (RA 10173). Immediate — no staff step. */
export async function GET() {
  const { org, user } = await getCurrentOrgContext();

  const data = await buildDataExport(user.id, org.id);
  if (!data) return new NextResponse("Not found", { status: 404 });

  await logAudit({ action: "privacy.export", target: user.fullName });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-hoa-data-${date}.json"`,
    },
  });
}
