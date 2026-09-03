"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CollectionMonth } from "@/lib/reports";
import { CHART } from "./palette";
import { ChartFrame } from "./ChartFrame";

export function CollectionRateTrendChart({ data }: { data: CollectionMonth[] }) {
  const pct = data.map((d) => ({
    ...d,
    ratePct: d.rate == null ? null : Math.round(d.rate * 1000) / 10,
  }));

  return (
    <ChartFrame
      title="Collection rate trend"
      note="Collected ÷ (opening receivables + amount billed), per month."
    >
      <LineChart
        width={640}
        height={220}
        data={pct}
        margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} />
        <YAxis
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          width={44}
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip formatter={(v: number) => `${v}%`} />
        <Line
          type="monotone"
          dataKey="ratePct"
          name="Collection rate"
          stroke={CHART.brand}
          strokeWidth={2}
          dot={{ r: 2 }}
          connectNulls
        />
      </LineChart>
    </ChartFrame>
  );
}
