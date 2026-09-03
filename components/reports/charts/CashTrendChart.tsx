"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { peso } from "@/lib/format";
import type { CashMonth } from "@/lib/reports";
import { CHART, compactPeso } from "./palette";
import { ChartFrame } from "./ChartFrame";

export function CashTrendChart({ data }: { data: CashMonth[] }) {
  return (
    <ChartFrame title="Cash position trend" note="Cash account balance at each month-end.">
      <LineChart
        width={640}
        height={220}
        data={data}
        margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} />
        <YAxis
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          width={54}
          tickFormatter={compactPeso}
        />
        <Tooltip formatter={(v: number) => peso(v)} />
        <Line
          type="monotone"
          dataKey="cash"
          name="Cash"
          stroke={CHART.brand}
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </LineChart>
    </ChartFrame>
  );
}
