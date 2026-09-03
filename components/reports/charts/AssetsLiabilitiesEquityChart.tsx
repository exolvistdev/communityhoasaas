"use client";

import {
  Bar,
  BarChart,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { peso } from "@/lib/format";
import { CHART, compactPeso } from "./palette";
import { ChartFrame } from "./ChartFrame";

export function AssetsLiabilitiesEquityChart({
  assets,
  liabilities,
  equity,
}: {
  assets: number;
  liabilities: number;
  equity: number;
}) {
  const data = [
    { name: "Assets", value: assets, fill: CHART.brand },
    { name: "Liabilities", value: liabilities, fill: CHART.warning },
    { name: "Fund balance", value: equity, fill: CHART.success },
  ];

  return (
    <ChartFrame title="Assets, liabilities & fund balance">
      <BarChart
        width={560}
        height={180}
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
      >
        <XAxis
          type="number"
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          tickFormatter={compactPeso}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: CHART.axis, fontSize: 11 }}
          tickLine={false}
          width={84}
        />
        <Tooltip formatter={(v: number) => peso(v)} cursor={{ fill: CHART.grid }} />
        <Bar dataKey="value" radius={[0, 2, 2, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
