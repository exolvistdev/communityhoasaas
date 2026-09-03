import { peso } from "@/lib/format";
import type { homeownersReport } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { CategoryDonut } from "./charts/CategoryDonut";
import { CHART } from "./charts/palette";

type Data = Awaited<ReturnType<typeof homeownersReport>>;

const STATUS_LABEL = {
  current: "Current",
  partial: "Partial",
  overdue: "Overdue",
} as const;

export function HomeownersDoc({ orgName, data }: { orgName: string; data: Data }) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Homeowners"
      periodLabel={`As of ${fmtDate(data.asOf)}`}
    >
      <div className="mt-4 flex gap-8 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Homeowners
          </div>
          <div className="font-medium">{data.count}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Own more than one unit
          </div>
          <div className="font-medium">{data.multiUnit}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Total balance
          </div>
          <div className="font-medium tabular-nums">{peso(data.totalBalance)}</div>
        </div>
      </div>

      {data.count > 0 && (
        <CategoryDonut
          title="Homeowners by balance status"
          data={[
            { name: "Current", value: data.byStatus.current },
            { name: "Partial", value: data.byStatus.partial },
            { name: "Overdue", value: data.byStatus.overdue },
          ]}
          colors={[CHART.success, CHART.warning, CHART.danger]}
        />
      )}

      {data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No homeowners on record.</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-3 font-medium">Homeowner</th>
              <th className="py-2 pr-3 font-medium">Unit(s)</th>
              <th className="py-2 pr-3 font-medium">Contact</th>
              <th className="py-2 pr-3 text-right font-medium">Balance</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Portal</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.key} className="border-b border-gray-100">
                <td className="py-1.5 pr-3">{r.name}</td>
                <td className="py-1.5 pr-3">{r.units.join(", ")}</td>
                <td className="py-1.5 pr-3">
                  {r.contactComplete ? "Complete" : "Incomplete"}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {peso(r.balance)}
                </td>
                <td className="py-1.5 pr-3">{STATUS_LABEL[r.status]}</td>
                <td className="py-1.5 pr-3">{r.portal}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 pr-3" colSpan={3}>
                Total ({data.count})
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(data.totalBalance)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      )}
    </ReportDoc>
  );
}
