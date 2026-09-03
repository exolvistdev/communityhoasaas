import { requireStaff } from "@/lib/rbac";
import { parseReportRange, lateFeesReport } from "@/lib/reports";
import { toCsvString, csvResponse } from "@/lib/csv";

const ymd = (d: Date) =>
  d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

export async function GET(request: Request) {
  const { org } = await requireStaff();
  const url = new URL(request.url);
  const range = parseReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const data = await lateFeesReport(org.id, range);

  const rows: (string | number)[][] = [
    [
      "unit",
      "homeowner",
      "date",
      "amount",
      "related_invoice",
      "occurrences_this_year",
    ],
  ];
  for (const r of data.rows)
    rows.push([
      r.unitNumber,
      r.homeownerName ?? "",
      ymd(r.date),
      r.amount.toFixed(2),
      r.relatedInvoice,
      r.occurrenceThisYear,
    ]);
  rows.push(["TOTAL", "", "", data.total.toFixed(2), "", ""]);

  return csvResponse(
    toCsvString(rows),
    `late-fees-${org.subdomain}-${range.fromYmd}_${range.toYmd}.csv`
  );
}
