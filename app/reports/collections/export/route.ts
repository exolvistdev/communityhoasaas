import { requireStaff } from "@/lib/rbac";
import { parseReportRange, collectionsSummary } from "@/lib/reports";
import { toCsvString, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const { org } = await requireStaff();
  const url = new URL(request.url);
  const range = parseReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const d = await collectionsSummary(org.id, { from: range.from, to: range.to });

  const rows: (string | number)[][] = [
    ["line", "amount"],
    ["Receivables at start of period", d.openingAR.toFixed(2)],
    ["Dues billed", d.duesBilled.toFixed(2)],
    ["Late fees billed", d.lateFeesBilled.toFixed(2)],
    ["Other charges billed", d.otherBilled.toFixed(2)],
    ["Payments collected", (-d.collected).toFixed(2)],
    ["Receivables at end of period", d.closingAR.toFixed(2)],
    [
      "Collection rate",
      d.collectionRate == null ? "" : `${(d.collectionRate * 100).toFixed(1)}%`,
    ],
  ];
  for (const m of d.byMethod)
    rows.push([`Payments — ${m.method} (${m.count})`, m.amount.toFixed(2)]);

  return csvResponse(
    toCsvString(rows),
    `collections-${org.subdomain}-${range.fromYmd}_${range.toYmd}.csv`
  );
}
