"use client";

import {
  Bar,
  BarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { peso } from "@/lib/format";
import { CHART, compactPeso } from "./palette";
import { ChartFrame } from "./ChartFrame";

/** Horizontal "top N" ranking bar chart (repeat offenders, top vendors). */
export function RankBarChart({
  title,
  note,
  data,
  unit = "peso",
  color = CHART.brand,
}: {
  title: string;
  note?: string;
  data: { name: string; value: number }[];
  unit?: "peso" | "count";
  color?: string;
}) {
  const fmt = (v: number) => (unit === "peso" ? peso(v) : String(v));
  const tickFmt = (v: number) => (unit === "peso" ? compactPeso(v) : String(v));
  const height = Math.max(120, data.length * 26 + 24);

  return (
    <ChartFrame title={title} note={note}>
      <BarChart
        width={560}
        height={height}
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
      >
        <XAxis
          type="number"
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          allowDecimals={unit === "peso"}
          tickFormatter={tickFmt}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          width={130}
        />
        <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: CHART.grid }} />
        <Bar dataKey="value" fill={color} radius={[0, 2, 2, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartFrame>
  );
}
