import { requireStaff } from "@/lib/rbac";
import { incomeStatement } from "@/lib/ledger";
import { parseReportRange, eachMonth, monthlyLedgerSeries } from "@/lib/reports";
import { PrintToolbar } from "@/components/PrintToolbar";
import { IncomeStatementDoc } from "@/components/reports/IncomeStatementDoc";

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const { org } = await requireStaff();
  const range = parseReportRange(searchParams);
  const [data, series] = await Promise.all([
    incomeStatement(org.id, { from: range.from, to: range.to }),
    monthlyLedgerSeries(org.id, eachMonth(range)),
  ]);
  const qs = `from=${range.fromYmd}&to=${range.toYmd}`;

  return (
    <>
      <PrintToolbar
        backHref="/reports"
        backLabel="All reports"
        csvHref={`/reports/income-statement/export?${qs}`}
      />
      <IncomeStatementDoc orgName={org.name} data={data} series={series} />
    </>
  );
}
