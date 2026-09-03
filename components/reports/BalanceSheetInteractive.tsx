"use client";

import { useCallback, useState } from "react";
import { peso, periodLabel } from "@/lib/format";
import type { balanceSheet } from "@/lib/ledger";
import type { CashMonth } from "@/lib/reports";
import { pickMonth } from "@/lib/report-filter";
import { AmountSection, fmtDate } from "./shared";
import { AssetsLiabilitiesEquityChart } from "./charts/AssetsLiabilitiesEquityChart";
import { CashTrendChart } from "./charts/CashTrendChart";
import { FilterChip, useClearOnPrint } from "./interactive";

type Data = Awaited<ReturnType<typeof balanceSheet>>;

export function BalanceSheetInteractive({
  data,
  cash,
}: {
  data: Data;
  cash: CashMonth[];
}) {
  const [month, setMonth] = useState<string | null>(null);
  const clear = useCallback(() => setMonth(null), []);
  useClearOnPrint(clear);

  const drill = pickMonth(cash, month);

  return (
    <>
      <AssetsLiabilitiesEquityChart
        assets={data.assets.total}
        liabilities={data.liabilities.total}
        equity={data.equity.total}
      />
      {cash.length > 0 && (
        <CashTrendChart data={cash} selectedMonth={month} onSelectMonth={setMonth} />
      )}

      {drill && (
        <>
          <FilterChip label={periodLabel(drill.key)} onClear={clear} />
          <p className="no-print mt-1 text-sm text-gray-600">
            Cash at the end of{" "}
            <span className="font-semibold">{periodLabel(drill.key)}</span>:{" "}
            <span className="font-semibold tabular-nums">{peso(drill.cash)}</span>
            <span className="ml-1 text-xs text-gray-400">
              (the statement below is as of {fmtDate(data.asOf)})
            </span>
          </p>
        </>
      )}

      <AmountSection
        heading="Assets"
        rows={data.assets.rows}
        total={data.assets.total}
        totalLabel="Total assets"
      />
      <AmountSection
        heading="Liabilities"
        rows={data.liabilities.rows}
        total={data.liabilities.total}
        totalLabel="Total liabilities"
      />
      <AmountSection
        heading="Fund balance"
        rows={data.equity.rows}
        total={data.equity.total}
        totalLabel="Total fund balance"
      />
      <div className="mt-6 flex items-center justify-between border-t-2 border-gray-900 pt-2 text-base font-semibold">
        <span>Liabilities + fund balance</span>
        <span className="tabular-nums">
          {peso(data.liabilities.total + data.equity.total)}
        </span>
      </div>
      <p
        className={`mt-3 text-sm ${
          data.balanced ? "text-green-700" : "text-red-700"
        }`}
      >
        {data.balanced
          ? "✓ Assets equal liabilities plus fund balance."
          : "⚠ Out of balance — check the ledger."}
      </p>
    </>
  );
}
