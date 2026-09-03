"use client";

import { useCallback, useState } from "react";
import { peso } from "@/lib/format";
import type { PayablesVendor } from "@/lib/reports";
import type { Aging } from "@/lib/soa";
import {
  AGING_BUCKET_LABEL,
  filterByAgingBucket,
  type AgingBucketKey,
} from "@/lib/report-filter";
import { BucketBarChart } from "./charts/BucketBarChart";
import { FilterChip, useClearOnPrint } from "./interactive";

const COLS: { key: AgingBucketKey; label: string }[] = [
  { key: "current", label: "Not due" },
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

export function PayablesInteractive({
  vendors,
  totals,
  count,
  outstanding,
}: {
  vendors: PayablesVendor[];
  totals: Aging;
  count: number;
  outstanding: number;
}) {
  const [bucket, setBucket] = useState<AgingBucketKey | null>(null);
  const clear = useCallback(() => setBucket(null), []);
  useClearOnPrint(clear);

  const visible = filterByAgingBucket(vendors, bucket);
  const footer = bucket
    ? visible.reduce(
        (acc, v) => {
          acc.outstanding += v.outstanding;
          for (const c of COLS) acc.aging[c.key] += v.aging[c.key];
          return acc;
        },
        { outstanding: 0, aging: emptyAging() }
      )
    : { outstanding, aging: totals };

  return (
    <>
      <div className="mt-4 flex gap-8 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Vendors owed
          </div>
          <div className="font-medium">{count}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Total payable
          </div>
          <div className="font-medium tabular-nums">{peso(outstanding)}</div>
        </div>
      </div>

      {outstanding > 0.005 && (
        <BucketBarChart
          title="Payables by aging bucket"
          totals={totals}
          currentLabel="Not due"
          selected={bucket}
          onSelect={setBucket}
        />
      )}

      {bucket && (
        <FilterChip
          label={`${AGING_BUCKET_LABEL[bucket]} (${visible.length})`}
          onClear={clear}
        />
      )}

      {vendors.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No outstanding bills.</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-3 font-medium">Vendor</th>
              <th className="py-2 pr-3 text-right font-medium">Owed</th>
              {COLS.map((c) => (
                <th key={c.key} className="py-2 pr-3 text-right font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((v) => (
              <tr key={v.vendorId} className="border-b border-gray-100">
                <td className="py-1.5 pr-3">{v.vendorName}</td>
                <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                  {peso(v.outstanding)}
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className="py-1.5 pr-3 text-right tabular-nums">
                    {v.aging[c.key] ? peso(v.aging[c.key]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="py-3 text-gray-400" colSpan={2 + COLS.length}>
                  No vendor has a balance in this bucket.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 pr-3">Total</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(footer.outstanding)}
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
