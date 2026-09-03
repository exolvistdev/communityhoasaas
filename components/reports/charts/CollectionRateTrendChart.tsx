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
import type { CollectionMonth } from "@/lib/reports";
import { CHART } from "./palette";
import { ChartFrame } from "./ChartFrame";

export function CollectionRateTrendChart({
  data,
  selectedMonth = null,
  onSelectMonth,
}: {
  data: CollectionMonth[];
  selectedMonth?: string | null;
  onSelectMonth?: (key: string | null) => void;
}) {
  const clickable = Boolean(onSelectMonth);
  const pct = data.map((d) => ({
    ...d,
    ratePct: d.rate == null ? null : Math.round(d.rate * 1000) / 10,
  }));
  const selectedLabel = data.find((d) => d.key === selectedMonth)?.label;

  return (
    <ChartFrame
      title="Collection rate trend"
      note={
        clickable
          ? "Click a month to see its numbers below."
          : "Collected ÷ (opening receivables + amount billed), per month."
      }
    >
      <LineChart
        width={640}
        height={220}
        data={pct}
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
          width={44}
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip formatter={(v: number) => `${v}%`} />
        {selectedLabel && (
          <ReferenceLine x={selectedLabel} stroke={CHART.brand} strokeDasharray="3 3" />
        )}
        <Line
          type="monotone"
          dataKey="ratePct"
          name="Collection rate"
          stroke={CHART.brand}
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ChartFrame>
  );
}
