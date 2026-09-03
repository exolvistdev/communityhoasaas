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
import { CHART, compactPeso } from "./palette";
import { ChartFrame } from "./ChartFrame";

/**
 * Receivables / payables by aging bucket. The 90+ bar is drawn in the danger
 * token to match the overdue badges elsewhere in the app.
 */
export function BucketBarChart({
  title,
  totals,
  currentLabel = "Current",
}: {
  title: string;
  totals: Aging;
  currentLabel?: string;
}) {
  const data = [
    { name: currentLabel, value: totals.current, danger: false },
    { name: "1–30", value: totals.d1_30, danger: false },
    { name: "31–60", value: totals.d31_60, danger: false },
    { name: "61–90", value: totals.d61_90, danger: false },
    { name: "90+", value: totals.d90plus, danger: true },
  ];

  return (
    <ChartFrame title={title}>
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
        <Bar dataKey="value" radius={[2, 2, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.danger ? CHART.danger : CHART.brand} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
