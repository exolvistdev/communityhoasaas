import { peso } from "@/lib/format";
import type { incomeStatement } from "@/lib/ledger";
import { ReportDoc, AmountSection, fmtDate } from "./shared";

type Data = Awaited<ReturnType<typeof incomeStatement>>;

export function IncomeStatementDoc({
  orgName,
  data,
}: {
  orgName: string;
  data: Data;
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
