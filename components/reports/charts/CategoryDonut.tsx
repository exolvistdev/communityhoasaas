"use client";

import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";
import { peso } from "@/lib/format";
import { CHART_SERIES } from "./palette";
import { ChartFrame } from "./ChartFrame";

/** Generic category donut (spend by category, resolution status, …). */
export function CategoryDonut({
  title,
  note,
  data,
}: {
  title: string;
  note?: string;
  data: { name: string; value: number }[];
}) {
  const shown = data.filter((d) => d.value > 0.005);

  return (
    <ChartFrame title={title} note={note}>
      <PieChart width={340} height={240}>
        <Pie
          data={shown}
          dataKey="value"
          nameKey="name"
          cx="45%"
          cy="50%"
          innerRadius={52}
          outerRadius={84}
          paddingAngle={2}
          isAnimationActive={false}
        >
          {shown.map((d, i) => (
            <Cell key={d.name} fill={CHART_SERIES[i % CHART_SERIES.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => peso(v)} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ChartFrame>
  );
}
