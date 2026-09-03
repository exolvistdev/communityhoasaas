import { requireStaff } from "@/lib/rbac";
import { parseReportRange, violationsReport } from "@/lib/reports";
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
  const data = await violationsReport(org.id, range);

  const rows: (string | number)[][] = [
    ["unit", "homeowner", "category", "logged", "status", "fine_amount"],
  ];
  for (const r of data.rows)
    rows.push([
      r.unitNumber,
      r.homeownerName ?? "",
      r.categoryLabel,
      ymd(r.loggedDate),
      r.statusLabel,
      r.fineAmount ? r.fineAmount.toFixed(2) : "",
    ]);
  rows.push(["TOTAL", "", "", "", "", data.totalFines.toFixed(2)]);

  return csvResponse(
    toCsvString(rows),
    `violations-${org.subdomain}-${range.fromYmd}_${range.toYmd}.csv`
  );
}
