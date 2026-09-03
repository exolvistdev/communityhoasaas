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

export function IncomeByCategoryChart({
  data,
  selectedMonth = null,
  onSelectMonth,
}: {
  data: LedgerMonth[];
  selectedMonth?: string | null;
  onSelectMonth?: (key: string | null) => void;
}) {
  const clickable = Boolean(onSelectMonth);
  const pick = (d: any) => {
    const key = d?.key ?? d?.payload?.key;
    if (key) onSelectMonth?.(selectedMonth === key ? null : key);
  };
  const dim = selectedMonth ? 0.35 : 1;
  const bar = {
    stackId: "i",
    fillOpacity: dim,
    isAnimationActive: false,
    onClick: clickable ? pick : undefined,
    className: clickable ? "cursor-pointer" : undefined,
  };

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
        <Bar name="Dues" dataKey="dues" fill={CHART.brand} {...bar} />
        <Bar name="Late fees" dataKey="lateFees" fill={CHART.info} {...bar} />
        <Bar name="Fines" dataKey="fines" fill={CHART.warning} {...bar} />
        <Bar
          name="Other"
          dataKey="otherIncome"
          fill={CHART.muted}
          radius={[2, 2, 0, 0]}
          {...bar}
        />
      </BarChart>
    </ChartFrame>
  );
}
