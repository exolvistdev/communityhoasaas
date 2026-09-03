"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { peso } from "@/lib/format";
import { CHART } from "./palette";
import { ChartFrame } from "./ChartFrame";

export function CollectedVsOutstandingChart({
  collected,
  outstanding,
  rate,
}: {
  collected: number;
  outstanding: number;
  rate: number | null;
}) {
  const data = [
    { name: "Collected", value: Math.max(0, collected), fill: CHART.success },
    { name: "Outstanding", value: Math.max(0, outstanding), fill: CHART.warning },
  ];

  return (
    <ChartFrame title="Collected vs. outstanding">
      <div className="relative" style={{ width: 300, height: 220 }}>
        <PieChart width={300} height={220}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => peso(v)} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-gray-900">
            {rate != null ? `${(rate * 100).toFixed(1)}%` : "—"}
          </span>
          <span className="text-[11px] text-gray-400">collection rate</span>
        </div>
      </div>
    </ChartFrame>
  );
}
