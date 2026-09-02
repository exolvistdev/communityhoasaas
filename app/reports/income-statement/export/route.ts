import { requireStaff } from "@/lib/rbac";
import { incomeStatement } from "@/lib/ledger";
import { parseReportRange } from "@/lib/reports";
import { toCsvString, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const { org } = await requireStaff();
  const url = new URL(request.url);
  const range = parseReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const data = await incomeStatement(org.id, { from: range.from, to: range.to });

  const rows: (string | number)[][] = [["section", "code", "account", "amount"]];
  for (const r of data.income)
    rows.push(["Income", r.code, r.name, r.amount.toFixed(2)]);
  rows.push(["Income", "", "Total income", data.incomeTotal.toFixed(2)]);
  for (const r of data.expense)
    rows.push(["Expenses", r.code, r.name, r.amount.toFixed(2)]);
  rows.push(["Expenses", "", "Total expenses", data.expenseTotal.toFixed(2)]);
  rows.push(["", "", "Net surplus (deficit)", data.netSurplus.toFixed(2)]);

  return csvResponse(
    toCsvString(rows),
    `income-statement-${org.subdomain}-${range.fromYmd}_${range.toYmd}.csv`
  );
}
