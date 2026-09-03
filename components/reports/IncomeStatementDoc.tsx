import type { incomeStatement } from "@/lib/ledger";
import type { LedgerMonth } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { IncomeStatementInteractive } from "./IncomeStatementInteractive";

type Data = Awaited<ReturnType<typeof incomeStatement>>;

export function IncomeStatementDoc({
  orgName,
  data,
  series = [],
}: {
  orgName: string;
  data: Data;
  series?: LedgerMonth[];
}) {
  const period = data.from
    ? `${fmtDate(data.from)} – ${fmtDate(data.to)}`
    : `Through ${fmtDate(data.to)}`;

  return (
    <ReportDoc
      orgName={orgName}
      title="Statement of Income & Expenses"
      periodLabel={period}
    >
      <IncomeStatementInteractive
        key={`${data.from ? data.from.toISOString() : "all"}-${data.to.toISOString()}`}
        data={data}
        series={series}
      />
    </ReportDoc>
  );
}
