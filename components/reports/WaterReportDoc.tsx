import { peso } from "@/lib/format";
import { formatConsumption } from "@/lib/water";
import type { waterReport } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { MonthlyBarChart } from "./charts/MonthlyBarChart";
import { RankBarChart } from "./charts/RankBarChart";
import { WaterCostChart } from "./charts/WaterCostChart";

type Data = Awaited<ReturnType<typeof waterReport>>;

export function WaterReportDoc({ orgName, data }: { orgName: string; data: Data }) {
  const bulk = data.mode === "EXTERNAL_BULK";

  return (
    <ReportDoc
      orgName={orgName}
      title="Water"
      periodLabel={`${fmtDate(data.from)} – ${fmtDate(data.to)}`}
    >
      <div className="mt-4 flex flex-wrap gap-8 text-sm">
        <Stat label="Consumption" value={formatConsumption(data.totals.consumption)} />
        <Stat label="Billed to residents" value={peso(data.totals.billed)} />
        {bulk && (
          <>
            <Stat
              label="Utility cost"
              value={data.totals.bulkCost == null ? "—" : peso(data.totals.bulkCost)}
            />
            <Stat
              label="Net position"
              value={
                data.totals.netPosition == null
                  ? "—"
                  : peso(data.totals.netPosition)
              }
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-x-10">
        {data.monthly.some((m) => m.consumption > 0) && (
          <MonthlyBarChart
            title="Consumption by month"
            note="Total metered m³ across all units."
            data={data.monthly.map((m) => ({ label: m.label, value: m.consumption }))}
            unit="m3"
          />
        )}
        {bulk && data.monthly.some((m) => m.bulkCost != null) && (
          <WaterCostChart data={data.monthly} />
        )}
        {data.topConsumers.length > 0 && (
          <RankBarChart
            title="Top consumers"
            note="By metered use over the period, top 10."
            data={data.topConsumers}
            unit="m3"
          />
        )}
      </div>

      {data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">
          No metered water use in this period.
        </p>
      ) : (
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-3 font-medium">Unit</th>
              <th className="py-2 pr-3 font-medium">Homeowner</th>
              <th className="py-2 pr-3 font-medium">Meter</th>
              <th className="py-2 pr-3 text-right font-medium">Latest month</th>
              <th className="py-2 pr-3 text-right font-medium">Period m³</th>
              <th className="py-2 pr-3 text-right font-medium">Period billed</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.propertyId} className="border-b border-gray-100">
                <td className="py-1.5 pr-3">{r.unitNumber}</td>
                <td className="py-1.5 pr-3">{r.homeownerName ?? "—"}</td>
                <td className="py-1.5 pr-3 text-gray-500">
                  {r.serialNumber ? `#${r.serialNumber}` : "—"}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {r.periodConsumption == null
                    ? "—"
                    : formatConsumption(r.periodConsumption)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {formatConsumption(r.rangeConsumption)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {peso(r.rangeBilled)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 pr-3" colSpan={4}>
                Total
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {formatConsumption(data.totals.consumption)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(data.totals.billed)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {bulk && (
        <p className="mt-4 text-[11px] text-gray-400">
          Net position = billed to residents − utility bulk bills for the period.
          A negative figure means the HOA absorbed system loss or fees.
        </p>
      )}
    </ReportDoc>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}
