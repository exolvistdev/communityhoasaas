import { peso } from "@/lib/format";
import type { lateFeesReport } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { MonthlyBarChart } from "./charts/MonthlyBarChart";
import { RankBarChart } from "./charts/RankBarChart";
import { CHART } from "./charts/palette";

type Data = Awaited<ReturnType<typeof lateFeesReport>>;

export function LateFeesDoc({ orgName, data }: { orgName: string; data: Data }) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Late Fees"
      periodLabel={`${fmtDate(data.from)} – ${fmtDate(data.to)}`}
    >
      <div className="mt-4 flex gap-8 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Late fees charged
          </div>
          <div className="font-medium">{data.count}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Total late-fee revenue
          </div>
          <div className="font-medium tabular-nums">{peso(data.total)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-10">
        <MonthlyBarChart
          title="Monthly late-fee revenue"
          note="Charged per month (account 4100)."
          data={data.monthly}
          color={CHART.warning}
        />
        {data.repeatOffenders.length > 0 && (
          <RankBarChart
            title="Repeat offenders"
            note="Late fees charged in this period, top 10 units."
            data={data.repeatOffenders}
            unit="count"
            color={CHART.danger}
          />
        )}
      </div>

      {data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">
          No late fees were charged in this period.
        </p>
      ) : (
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-3 font-medium">Unit</th>
              <th className="py-2 pr-3 font-medium">Homeowner</th>
              <th className="py-2 pr-3 font-medium">Late fee date</th>
              <th className="py-2 pr-3 text-right font-medium">Amount</th>
              <th className="py-2 pr-3 font-medium">Related invoice</th>
              <th className="py-2 pr-3 text-right font-medium">
                Occurrences this year
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 whitespace-nowrap">{r.unitNumber}</td>
                <td className="py-1.5 pr-3">{r.homeownerName ?? "—"}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {peso(r.amount)}
                </td>
                <td className="py-1.5 pr-3">{r.relatedInvoice}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {r.occurrenceThisYear}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 pr-3" colSpan={3}>
                Total
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(data.total)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      )}
    </ReportDoc>
  );
}
