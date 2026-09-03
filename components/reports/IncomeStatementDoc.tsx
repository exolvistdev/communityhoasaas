import { peso } from "@/lib/format";
import type { incomeStatement } from "@/lib/ledger";
import type { LedgerMonth } from "@/lib/reports";
import { ReportDoc, AmountSection, fmtDate } from "./shared";
import { IncomeVsExpenseChart } from "./charts/IncomeVsExpenseChart";
import { IncomeByCategoryChart } from "./charts/IncomeByCategoryChart";

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
      {series.length > 0 && (
        <>
          <IncomeVsExpenseChart data={series} />
          <IncomeByCategoryChart data={series} />
        </>
      )}
      <AmountSection
        heading="Income"
        rows={data.income}
        total={data.incomeTotal}
        totalLabel="Total income"
      />
      <AmountSection
        heading="Expenses"
        rows={data.expense}
        total={data.expenseTotal}
        totalLabel="Total expenses"
      />
      <div className="mt-6 flex items-center justify-between border-t-2 border-gray-900 pt-2 text-base font-semibold">
        <span>Net surplus (deficit)</span>
        <span
          className={`tabular-nums ${
            data.netSurplus < 0 ? "text-red-700" : ""
          }`}
        >
          {peso(data.netSurplus)}
        </span>
      </div>
      <p className="mt-4 text-xs text-gray-400">
        Cash-basis. Dues and payments post on their transaction date; expenses
        and other income on the date recorded.
      </p>
    </ReportDoc>
  );
}
