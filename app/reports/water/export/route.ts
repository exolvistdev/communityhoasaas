import { requireStaff } from "@/lib/rbac";
import { parseReportRange, waterReport } from "@/lib/reports";
import { waterMetered } from "@/lib/water";
import { toCsvString, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const { org } = await requireStaff();
  if (!waterMetered(org.waterSource))
    return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const range = parseReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const data = await waterReport(org.id, range);
  const bulk = data.mode === "EXTERNAL_BULK";

  const rows: (string | number)[][] = [
    ["unit", "homeowner", "meter", "latest_month_m3", "period_m3", "period_billed"],
  ];
  for (const r of data.rows)
    rows.push([
      r.unitNumber,
      r.homeownerName ?? "",
      r.serialNumber ?? "",
      r.periodConsumption == null ? "" : r.periodConsumption.toFixed(2),
      r.rangeConsumption.toFixed(2),
      r.rangeBilled.toFixed(2),
    ]);
  rows.push([
    "TOTAL",
    "",
    "",
    "",
    data.totals.consumption.toFixed(2),
    data.totals.billed.toFixed(2),
  ]);
  rows.push([]);
  rows.push(["month", "consumption_m3", "billed", ...(bulk ? ["utility_bill", "loss_pct"] : [])]);
  for (const m of data.monthly)
    rows.push([
      m.label,
      m.consumption.toFixed(2),
      m.billed.toFixed(2),
      ...(bulk
        ? [
            m.bulkCost == null ? "" : m.bulkCost.toFixed(2),
            m.lossPct == null ? "" : m.lossPct.toFixed(1),
          ]
        : []),
    ]);

  return csvResponse(
    toCsvString(rows),
    `water-${org.subdomain}-${range.fromYmd}_${range.toYmd}.csv`
  );
}
