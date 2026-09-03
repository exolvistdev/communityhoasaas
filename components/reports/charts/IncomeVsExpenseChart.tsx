"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { peso } from "@/lib/format";
import type { LedgerMonth } from "@/lib/reports";
import { CHART, compactPeso } from "./palette";
import { ChartFrame } from "./ChartFrame";

export function IncomeVsExpenseChart({
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
  const opacity = (key: string) =>
    selectedMonth && selectedMonth !== key ? 0.3 : 1;

  return (
    <ChartFrame
      title="Income vs. expenses over time"
      note={
        clickable
          ? "Click a month to drill the tables below into that month."
          : "Cash-basis, by the month each entry posts."
      }
    >
      <BarChart
        width={640}
        height={230}
        data={data}
        margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
        barGap={2}
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
        <Bar
          name="Income"
          dataKey="income"
          fill={CHART.success}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
          onClick={clickable ? pick : undefined}
          className={clickable ? "cursor-pointer" : undefined}
        >
          {data.map((m) => (
            <Cell key={m.key} fill={CHART.success} fillOpacity={opacity(m.key)} />
          ))}
        </Bar>
        <Bar
          name="Expenses"
          dataKey="expense"
          fill={CHART.danger}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
          onClick={clickable ? pick : undefined}
          className={clickable ? "cursor-pointer" : undefined}
        >
          {data.map((m) => (
            <Cell key={m.key} fill={CHART.danger} fillOpacity={opacity(m.key)} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
