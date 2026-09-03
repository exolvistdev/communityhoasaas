import { requireStaff } from "@/lib/rbac";
import { parseReportRange, vendorSpendReport } from "@/lib/reports";
import { toCsvString, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const { org } = await requireStaff();
  const url = new URL(request.url);
  const range = parseReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const data = await vendorSpendReport(org.id, range);

  const rows: (string | number)[][] = [
    ["vendor", "category", "total_billed", "total_paid", "open_balance"],
  ];
  for (const v of data.vendors)
    rows.push([
      v.vendorName,
      v.category,
      v.totalBilled.toFixed(2),
      v.totalPaid.toFixed(2),
      v.openBalance.toFixed(2),
    ]);
  rows.push([
    "TOTAL",
    "",
    data.totalBilled.toFixed(2),
    data.totalPaid.toFixed(2),
    data.openBalance.toFixed(2),
  ]);

  return csvResponse(
    toCsvString(rows),
    `vendor-spend-${org.subdomain}-${range.fromYmd}_${range.toYmd}.csv`
  );
}
