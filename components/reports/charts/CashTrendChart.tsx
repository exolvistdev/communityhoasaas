"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { peso } from "@/lib/format";
import type { CashMonth } from "@/lib/reports";
import { CHART, compactPeso } from "./palette";
import { ChartFrame } from "./ChartFrame";

export function CashTrendChart({
  data,
  selectedMonth = null,
  onSelectMonth,
}: {
  data: CashMonth[];
  selectedMonth?: string | null;
  onSelectMonth?: (key: string | null) => void;
}) {
  const clickable = Boolean(onSelectMonth);
  const selectedLabel = data.find((d) => d.key === selectedMonth)?.label;

  return (
    <ChartFrame
      title="Cash position trend"
      note={
        clickable
          ? "Click a month to see its cash balance below."
          : "Cash account balance at each month-end."
      }
    >
      <LineChart
        width={640}
        height={220}
        data={data}
        margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
        onClick={
          clickable
            ? (e: any) => {
                const key = e?.activePayload?.[0]?.payload?.key;
                if (key) onSelectMonth?.(selectedMonth === key ? null : key);
              }
            : undefined
        }
        className={clickable ? "cursor-pointer" : undefined}
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
        {selectedLabel && (
          <ReferenceLine x={selectedLabel} stroke={CHART.brand} strokeDasharray="3 3" />
        )}
        <Line
          type="monotone"
          dataKey="cash"
          name="Cash"
          stroke={CHART.brand}
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFrame>
  );
}
