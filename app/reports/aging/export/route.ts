import { requireStaff } from "@/lib/rbac";
import { parseReportRange, agingSnapshot } from "@/lib/reports";
import { toCsvString, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const { org } = await requireStaff();
  const url = new URL(request.url);
  const range = parseReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const data = await agingSnapshot(org.id, range.to);

  const rows: (string | number)[][] = [
    ["unit", "homeowner", "balance", "current", "1-30", "31-60", "61-90", "90+"],
  ];
  for (const u of data.units)
    rows.push([
      u.unitNumber,
      u.homeownerName ?? "",
      u.balance.toFixed(2),
      u.aging.current.toFixed(2),
      u.aging.d1_30.toFixed(2),
      u.aging.d31_60.toFixed(2),
      u.aging.d61_90.toFixed(2),
      u.aging.d90plus.toFixed(2),
    ]);
  rows.push([
    "TOTAL",
    "",
    data.outstanding.toFixed(2),
    data.totals.current.toFixed(2),
    data.totals.d1_30.toFixed(2),
    data.totals.d31_60.toFixed(2),
    data.totals.d61_90.toFixed(2),
    data.totals.d90plus.toFixed(2),
  ]);

  return csvResponse(
    toCsvString(rows),
    `aging-${org.subdomain}-${range.toYmd}.csv`
  );
}
