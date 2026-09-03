import { peso } from "@/lib/format";
import type { violationsReport } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { RankBarChart } from "./charts/RankBarChart";
import { CategoryDonut } from "./charts/CategoryDonut";
import { CHART } from "./charts/palette";

type Data = Awaited<ReturnType<typeof violationsReport>>;

export function ViolationsReportDoc({
  orgName,
  data,
}: {
  orgName: string;
  data: Data;
}) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Violations & Fines"
      periodLabel={`${fmtDate(data.from)} – ${fmtDate(data.to)}`}
    >
      <div className="mt-4 flex gap-8 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Logged this period
          </div>
          <div className="font-medium">{data.count}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Still open
          </div>
          <div className="font-medium">{data.openCount}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Fines charged
          </div>
          <div className="font-medium tabular-nums">{peso(data.totalFines)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-10">
        {data.byCategory.length > 0 && (
          <RankBarChart
            title="Violations by category"
            data={data.byCategory}
            unit="count"
            color={CHART.warning}
          />
        )}
        {data.count > 0 && (
          <CategoryDonut
            title="Resolution status"
            data={data.resolution}
            colors={[CHART.warning, CHART.brand, CHART.success]}
          />
        )}
      </div>

      {data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">
          No violations were logged in this period.
        </p>
      ) : (
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-3 font-medium">Unit</th>
              <th className="py-2 pr-3 font-medium">Homeowner</th>
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 font-medium">Logged</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 text-right font-medium">Fine</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.violationId} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 whitespace-nowrap">{r.unitNumber}</td>
                <td className="py-1.5 pr-3">{r.homeownerName ?? "—"}</td>
                <td className="py-1.5 pr-3">{r.categoryLabel}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap">
                  {fmtDate(r.loggedDate)}
                </td>
                <td className="py-1.5 pr-3">{r.statusLabel}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {r.fineAmount ? peso(r.fineAmount) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 pr-3" colSpan={5}>
                Total fines
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(data.totalFines)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </ReportDoc>
  );
}
