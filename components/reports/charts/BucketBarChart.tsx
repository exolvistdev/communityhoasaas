"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { peso } from "@/lib/format";
import type { Aging } from "@/lib/soa";
import type { AgingBucketKey } from "@/lib/report-filter";
import { CHART, compactPeso } from "./palette";
import { ChartFrame } from "./ChartFrame";

/**
 * Receivables / payables by aging bucket. The 90+ bar is drawn in the danger
 * token to match the overdue badges elsewhere in the app. When `onSelect` is
 * passed, clicking a bar filters the table (click the active bar again to
 * clear); non-selected bars dim.
 */
export function BucketBarChart({
  title,
  totals,
  currentLabel = "Current",
  selected = null,
  onSelect,
}: {
  title: string;
  totals: Aging;
  currentLabel?: string;
  selected?: AgingBucketKey | null;
  onSelect?: (bucket: AgingBucketKey | null) => void;
}) {
  const data: { bucket: AgingBucketKey; name: string; value: number; danger: boolean }[] = [
    { bucket: "current", name: currentLabel, value: totals.current, danger: false },
    { bucket: "d1_30", name: "1–30", value: totals.d1_30, danger: false },
    { bucket: "d31_60", name: "31–60", value: totals.d31_60, danger: false },
    { bucket: "d61_90", name: "61–90", value: totals.d61_90, danger: false },
    { bucket: "d90plus", name: "90+", value: totals.d90plus, danger: true },
  ];

  const clickable = Boolean(onSelect);
  const handle = (d: (typeof data)[number]) =>
    onSelect?.(selected === d.bucket ? null : d.bucket);

  return (
    <ChartFrame
      title={title}
      note={clickable ? "Click a bar to filter the table below." : undefined}
    >
      <BarChart
        width={560}
        height={220}
        data={data}
        margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} />
        <YAxis
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          width={54}
          tickFormatter={compactPeso}
        />
        <Tooltip formatter={(v: number) => peso(v)} cursor={{ fill: CHART.grid }} />
        <Bar
          dataKey="value"
          radius={[2, 2, 0, 0]}
          onClick={clickable ? (d: any) => handle(d) : undefined}
          className={clickable ? "cursor-pointer" : undefined}
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell
              key={d.bucket}
              fill={d.danger ? CHART.danger : CHART.brand}
              fillOpacity={selected && selected !== d.bucket ? 0.3 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
