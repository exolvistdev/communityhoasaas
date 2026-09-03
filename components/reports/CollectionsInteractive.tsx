"use client";

import { useCallback, useState } from "react";
import { peso, periodLabel } from "@/lib/format";
import type { collectionsSummary, CollectionMonth } from "@/lib/reports";
import { pickMonth } from "@/lib/report-filter";
import { CollectedVsOutstandingChart } from "./charts/CollectedVsOutstandingChart";
import { CollectionRateTrendChart } from "./charts/CollectionRateTrendChart";
import { FilterChip, useClearOnPrint } from "./interactive";

type Data = Awaited<ReturnType<typeof collectionsSummary>>;

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank transfer",
  GCASH: "GCash",
  MAYA: "Maya",
  WRITE_OFF: "Write-off",
};

export function CollectionsInteractive({
  data,
  series,
}: {
  data: Data;
  series: CollectionMonth[];
}) {
  const [month, setMonth] = useState<string | null>(null);
  const clear = useCallback(() => setMonth(null), []);
  useClearOnPrint(clear);

  const drill = pickMonth(series, month);

  const Line = ({
    label,
    value,
    strong,
  }: {
    label: string;
    value: number;
    strong?: boolean;
  }) => (
    <tr className={strong ? "border-t-2 border-gray-300 font-semibold" : ""}>
      <td className="py-1.5 pr-4">{label}</td>
      <td className="py-1.5 text-right tabular-nums">{peso(value)}</td>
    </tr>
  );

  return (
    <>
      {/* The donut is a whole-period snapshot — collected vs outstanding — with
          no table rows for a click to filter, so it stays display-only. The
          rate-trend line drills to a single month. */}
      <div className="flex flex-wrap items-start gap-x-10 gap-y-2">
        <CollectedVsOutstandingChart
          collected={data.collected}
          outstanding={data.closingAR}
          rate={data.collectionRate}
        />
        {series.length > 0 && (
          <CollectionRateTrendChart
            data={series}
            selectedMonth={month}
            onSelectMonth={setMonth}
          />
        )}
      </div>

      {drill && (
        <>
          <FilterChip label={periodLabel(drill.key)} onClear={clear} />
          <div className="no-print mt-1 rounded-md bg-surface-2 px-3 py-2 text-sm text-gray-600">
            <span className="font-semibold text-gray-900">
              {periodLabel(drill.key)}
            </span>{" "}
            — opening receivables {peso(drill.openingAR)} · billed{" "}
            {peso(drill.billed)} · collected {peso(drill.collected)} · rate{" "}
            <span className="font-semibold">
              {drill.rate == null ? "—" : `${(drill.rate * 100).toFixed(1)}%`}
            </span>
          </div>
        </>
      )}

      <table className="mt-6 w-full border-collapse">
        <tbody>
          <Line label="Receivables at start of period" value={data.openingAR} />
          <Line label="Dues billed" value={data.duesBilled} />
          <Line label="Late fees billed" value={data.lateFeesBilled} />
          {Math.abs(data.otherBilled) > 0.005 && (
            <Line label="Other charges billed" value={data.otherBilled} />
          )}
          <Line label="Payments collected" value={-data.collected} />
          <Line
            label="Receivables at end of period"
            value={data.closingAR}
            strong
          />
        </tbody>
      </table>

      {data.collectionRate != null && (
        <p className="mt-4 text-sm text-gray-600">
          Collection rate:{" "}
          <span className="font-semibold">
            {(data.collectionRate * 100).toFixed(1)}%
          </span>{" "}
          of amounts owed during the period.
        </p>
      )}

      {data.byMethod.length > 0 && (
        <>
          <div className="mt-6 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Payments by method
          </div>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {data.byMethod.map((m) => (
                <tr key={m.method} className="border-b border-gray-100">
                  <td className="py-1.5 pr-4">
                    {METHOD_LABEL[m.method] ?? m.method}
                    <span className="ml-2 text-xs text-gray-400">
                      {m.count} payment{m.count === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {peso(m.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
