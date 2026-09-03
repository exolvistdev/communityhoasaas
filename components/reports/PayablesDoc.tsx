import { peso } from "@/lib/format";
import type { payablesAging } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { BucketBarChart } from "./charts/BucketBarChart";

type Data = Awaited<ReturnType<typeof payablesAging>>;

const COLS = [
  { key: "current", label: "Not due" },
  { key: "d1_30", label: "1–30" },
  { key: "d31_60", label: "31–60" },
  { key: "d61_90", label: "61–90" },
  { key: "d90plus", label: "90+" },
] as const;

export function PayablesDoc({ orgName, data }: { orgName: string; data: Data }) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Accounts Payable Aging"
      periodLabel={`As of ${fmtDate(data.asOf)}`}
    >
      <div className="mt-4 flex gap-8 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Vendors owed
          </div>
          <div className="font-medium">{data.count}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Total payable
          </div>
          <div className="font-medium tabular-nums">{peso(data.outstanding)}</div>
        </div>
      </div>

      {data.outstanding > 0.005 && (
        <BucketBarChart
          title="Payables by aging bucket"
          totals={data.totals}
          currentLabel="Not due"
        />
      )}

      {data.vendors.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">No outstanding bills.</p>
      ) : (
        <table className="mt-6 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-3 font-medium">Vendor</th>
              <th className="py-2 pr-3 text-right font-medium">Owed</th>
              {COLS.map((c) => (
                <th key={c.key} className="py-2 pr-3 text-right font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.vendors.map((v) => (
              <tr key={v.vendorId} className="border-b border-gray-100">
                <td className="py-1.5 pr-3">{v.vendorName}</td>
                <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                  {peso(v.outstanding)}
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className="py-1.5 pr-3 text-right tabular-nums">
                    {v.aging[c.key] ? peso(v.aging[c.key]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 pr-3">Total</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(data.outstanding)}
              </td>
              {COLS.map((c) => (
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
