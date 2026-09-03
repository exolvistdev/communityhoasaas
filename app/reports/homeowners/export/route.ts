import { requireStaff } from "@/lib/rbac";
import { parseReportRange, homeownersReport } from "@/lib/reports";
import { toCsvString, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const { org } = await requireStaff();
  const url = new URL(request.url);
  const range = parseReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const data = await homeownersReport(org.id, range.to);

  const rows: (string | number)[][] = [
    ["homeowner", "units", "contact_complete", "balance", "status", "portal"],
  ];
  for (const r of data.rows)
    rows.push([
      r.name,
      r.units.join(" / "),
      r.contactComplete ? "yes" : "no",
      r.balance.toFixed(2),
      r.status,
      r.portal,
    ]);
  rows.push(["TOTAL", "", "", data.totalBalance.toFixed(2), "", ""]);

  return csvResponse(
    toCsvString(rows),
    `homeowners-${org.subdomain}-${range.toYmd}.csv`
  );
}
