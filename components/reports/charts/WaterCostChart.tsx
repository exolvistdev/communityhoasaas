"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { peso } from "@/lib/format";
import { CHART, compactPeso } from "./palette";
import { ChartFrame } from "./ChartFrame";

/**
 * EXTERNAL_BULK only: what residents were billed vs. the utility's bulk bill
 * (left axis, ₱) with the system-loss % on the right axis.
 */
export function WaterCostChart({
  data,
}: {
  data: {
    label: string;
    billed: number;
    bulkCost: number | null;
    lossPct: number | null;
  }[];
}) {
  return (
    <ChartFrame
      title="Resident charges vs. utility cost"
      note="Bars: billed to residents vs. the utility's bulk bill. Line: system loss %."
    >
      <ComposedChart
        width={640}
        height={240}
        data={data}
        margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
        />
        <YAxis
          yAxisId="peso"
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          width={54}
          tickFormatter={compactPeso}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          domain={[0, "auto"]}
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          width={40}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          formatter={(v: number, n: string) =>
            n === "Loss %" ? `${v}%` : peso(v)
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId="peso"
          name="Billed to residents"
          dataKey="billed"
          fill={CHART.brand}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          yAxisId="peso"
          name="Utility bill"
          dataKey="bulkCost"
          fill={CHART.warning}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
        />
        <Line
          yAxisId="pct"
          name="Loss %"
          type="monotone"
          dataKey="lossPct"
          stroke={CHART.danger}
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </ChartFrame>
  );
}
