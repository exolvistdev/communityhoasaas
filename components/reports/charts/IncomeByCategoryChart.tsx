"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { peso } from "@/lib/format";
import type { LedgerMonth } from "@/lib/reports";
import { CHART, compactPeso } from "./palette";
import { ChartFrame } from "./ChartFrame";

export function IncomeByCategoryChart({ data }: { data: LedgerMonth[] }) {
  return (
    <ChartFrame title="Income by category">
      <BarChart
        width={640}
        height={230}
        data={data}
        margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
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
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar name="Dues" dataKey="dues" stackId="i" fill={CHART.brand} />
        <Bar name="Late fees" dataKey="lateFees" stackId="i" fill={CHART.info} />
        <Bar name="Fines" dataKey="fines" stackId="i" fill={CHART.warning} />
        <Bar name="Other" dataKey="otherIncome" stackId="i" fill={CHART.muted} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}
