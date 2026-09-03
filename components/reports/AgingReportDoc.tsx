import { peso } from "@/lib/format";
import type { agingSnapshot } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { BucketBarChart } from "./charts/BucketBarChart";

type Data = Awaited<ReturnType<typeof agingSnapshot>>;

export function AgingReportDoc({
  orgName,
  data,
}: {
  orgName: string;
  data: Data;
}) {
  const cols: { key: keyof Data["totals"]; label: string }[] = [
    { key: "current", label: "Current" },
    { key: "d1_30", label: "1–30" },
    { key: "d31_60", label: "31–60" },
    { key: "d61_90", label: "61–90" },
    { key: "d90plus", label: "90+" },
  ];

  return (
    <ReportDoc
      orgName={orgName}
      title="Accounts Receivable Aging"
      periodLabel={`As of ${fmtDate(data.asOf)}`}
    >
      <div className="mt-4 flex gap-8 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Units with a balance
          </div>
          <div className="font-medium">{data.count}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Total outstanding
          </div>
          <div className="font-medium tabular-nums">
            {peso(data.outstanding)}
          </div>
        </div>
      </div>

      {data.outstanding > 0.005 && (
        <BucketBarChart title="Receivables by aging bucket" totals={data.totals} />
      )}

      {data.units.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">
          No unit has an outstanding balance.
        </p>
      ) : (
        <table className="mt-6 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-3 font-medium">Unit</th>
              <th className="py-2 pr-3 font-medium">Homeowner</th>
              <th className="py-2 pr-3 text-right font-medium">Balance</th>
              {cols.map((c) => (
                <th key={c.key} className="py-2 pr-3 text-right font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.units.map((u) => (
              <tr key={u.propertyId} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 whitespace-nowrap">{u.unitNumber}</td>
                <td className="py-1.5 pr-3">{u.homeownerName ?? "—"}</td>
                <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                  {peso(u.balance)}
                </td>
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className="py-1.5 pr-3 text-right tabular-nums"
                  >
                    {u.aging[c.key] ? peso(u.aging[c.key]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 pr-3" colSpan={2}>
                Total
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(data.outstanding)}
              </td>
              {cols.map((c) => (
                <td key={c.key} className="py-2 pr-3 text-right tabular-nums">
                  {peso(data.totals[c.key])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      )}
    </ReportDoc>
  );
}
