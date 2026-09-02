import { requireStaff } from "@/lib/rbac";
import { balanceSheet } from "@/lib/ledger";
import { parseReportRange } from "@/lib/reports";
import { toCsvString, csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const { org } = await requireStaff();
  const url = new URL(request.url);
  const range = parseReportRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const data = await balanceSheet(org.id, range.to);

  const rows: (string | number)[][] = [["section", "code", "account", "amount"]];
  const section = (name: string, s: { rows: { code: string; name: string; amount: number }[]; total: number }) => {
    for (const r of s.rows) rows.push([name, r.code, r.name, r.amount.toFixed(2)]);
    rows.push([name, "", `Total ${name.toLowerCase()}`, s.total.toFixed(2)]);
  };
  section("Assets", data.assets);
  section("Liabilities", data.liabilities);
  section("Fund balance", data.equity);
  rows.push([
    "",
    "",
    "Liabilities + fund balance",
    (data.liabilities.total + data.equity.total).toFixed(2),
  ]);

  return csvResponse(
    toCsvString(rows),
    `balance-sheet-${org.subdomain}-${range.toYmd}.csv`
  );
}
