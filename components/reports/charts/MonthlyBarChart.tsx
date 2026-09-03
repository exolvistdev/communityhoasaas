"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { peso } from "@/lib/format";
import { CHART, compactPeso } from "./palette";
import { ChartFrame } from "./ChartFrame";

/** Single-series monthly bar chart (e.g. late-fee revenue, or water m³ by month). */
export function MonthlyBarChart({
  title,
  note,
  data,
  color = CHART.brand,
  unit = "peso",
}: {
  title: string;
  note?: string;
  data: { label: string; value: number }[];
  color?: string;
  unit?: "peso" | "m3";
}) {
  const fmt = (v: number) => (unit === "peso" ? peso(v) : `${v} m³`);
  const tickFmt = (v: number) => (unit === "peso" ? compactPeso(v) : String(v));
  return (
    <ChartFrame title={title} note={note}>
      <BarChart
        width={640}
        height={220}
        data={data}
        margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} />
        <YAxis
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          width={54}
          tickFormatter={tickFmt}
        />
        <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: CHART.grid }} />
        <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartFrame>
  );
}
