"use client";

import { useCallback, useState } from "react";
import { peso, periodLabel } from "@/lib/format";
import type { incomeStatement } from "@/lib/ledger";
import type { LedgerMonth } from "@/lib/reports";
import { pickLedgerMonth } from "@/lib/report-filter";
import { AmountSection } from "./shared";
import { IncomeVsExpenseChart } from "./charts/IncomeVsExpenseChart";
import { IncomeByCategoryChart } from "./charts/IncomeByCategoryChart";
import { FilterChip, useClearOnPrint } from "./interactive";

type Data = Awaited<ReturnType<typeof incomeStatement>>;

export function IncomeStatementInteractive({
  data,
  series,
}: {
  data: Data;
  series: LedgerMonth[];
}) {
  const [month, setMonth] = useState<string | null>(null);
  const clear = useCallback(() => setMonth(null), []);
  useClearOnPrint(clear);

  const drill = pickLedgerMonth(series, month);
  const income = drill ? drill.incomeRows : data.income;
  const expense = drill ? drill.expenseRows : data.expense;
  const incomeTotal = drill ? drill.income : data.incomeTotal;
  const expenseTotal = drill ? drill.expense : data.expenseTotal;
  const netSurplus = incomeTotal - expenseTotal;

  return (
    <>
      {series.length > 0 && (
        <>
          <IncomeVsExpenseChart
            data={series}
            selectedMonth={month}
            onSelectMonth={setMonth}
          />
          <IncomeByCategoryChart
            data={series}
            selectedMonth={month}
            onSelectMonth={setMonth}
          />
        </>
      )}

      {drill && (
        <FilterChip label={periodLabel(drill.key)} onClear={clear} />
      )}

      <AmountSection
        heading={drill ? `Income — ${periodLabel(drill.key)}` : "Income"}
        rows={income}
        total={incomeTotal}
        totalLabel="Total income"
      />
      <AmountSection
        heading={drill ? `Expenses — ${periodLabel(drill.key)}` : "Expenses"}
        rows={expense}
        total={expenseTotal}
        totalLabel="Total expenses"
      />
      <div className="mt-6 flex items-center justify-between border-t-2 border-gray-900 pt-2 text-base font-semibold">
        <span>Net surplus (deficit)</span>
        <span className={`tabular-nums ${netSurplus < 0 ? "text-red-700" : ""}`}>
          {peso(netSurplus)}
        </span>
      </div>
      <p className="mt-4 text-xs text-gray-400">
        Cash-basis. Dues and payments post on their transaction date; expenses
        and other income on the date recorded.
      </p>
    </>
  );
}
