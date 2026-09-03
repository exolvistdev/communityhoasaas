"use client";

import { useCallback, useState } from "react";
import { peso } from "@/lib/format";
import type { AgingUnit } from "@/lib/reports";
import type { Aging } from "@/lib/soa";
import {
  AGING_BUCKET_LABEL,
  filterByAgingBucket,
  type AgingBucketKey,
} from "@/lib/report-filter";
import { BucketBarChart } from "./charts/BucketBarChart";
import { FilterChip, useClearOnPrint } from "./interactive";

const COLS: { key: AgingBucketKey; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "d1_30", label: "1–30" },
  { key: "d31_60", label: "31–60" },
  { key: "d61_90", label: "61–90" },
  { key: "d90plus", label: "90+" },
];

const emptyAging = (): Aging => ({
  current: 0,
  d1_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90plus: 0,
});

export function AgingInteractive({
  units,
  totals,
  count,
  outstanding,
}: {
  units: AgingUnit[];
  totals: Aging;
  count: number;
  outstanding: number;
}) {
  const [bucket, setBucket] = useState<AgingBucketKey | null>(null);
  const clear = useCallback(() => setBucket(null), []);
  useClearOnPrint(clear);

  const visible = filterByAgingBucket(units, bucket);
  const footer = bucket
    ? visible.reduce(
        (acc, u) => {
          acc.balance += u.balance;
          for (const c of COLS) acc.aging[c.key] += u.aging[c.key];
          return acc;
        },
        { balance: 0, aging: emptyAging() }
      )
    : { balance: outstanding, aging: totals };

  return (
    <>
      <div className="mt-4 flex gap-8 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Units with a balance
          </div>
          <div className="font-medium">{count}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Total outstanding
          </div>
          <div className="font-medium tabular-nums">{peso(outstanding)}</div>
        </div>
      </div>

      {outstanding > 0.005 && (
        <BucketBarChart
          title="Receivables by aging bucket"
          totals={totals}
          selected={bucket}
          onSelect={setBucket}
        />
      )}

      {bucket && (
        <FilterChip label={`${AGING_BUCKET_LABEL[bucket]} (${visible.length})`} onClear={clear} />
      )}

      {units.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">
          No unit has an outstanding balance.
        </p>
      ) : (
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-3 font-medium">Unit</th>
              <th className="py-2 pr-3 font-medium">Homeowner</th>
              <th className="py-2 pr-3 text-right font-medium">Balance</th>
              {COLS.map((c) => (
                <th key={c.key} className="py-2 pr-3 text-right font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <tr key={u.propertyId} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 whitespace-nowrap">{u.unitNumber}</td>
                <td className="py-1.5 pr-3">{u.homeownerName ?? "—"}</td>
                <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                  {peso(u.balance)}
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className="py-1.5 pr-3 text-right tabular-nums">
                    {u.aging[c.key] ? peso(u.aging[c.key]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="py-3 text-gray-400" colSpan={3 + COLS.length}>
                  No unit has a balance in this bucket.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 pr-3" colSpan={2}>
                Total
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(footer.balance)}
              </td>
              {COLS.map((c) => (
                <td key={c.key} className="py-2 pr-3 text-right tabular-nums">
                  {peso(footer.aging[c.key])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      )}
    </>
  );
}
