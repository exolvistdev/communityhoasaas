import { peso } from "@/lib/format";
import type { vendorSpendReport } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";
import { RankBarChart } from "./charts/RankBarChart";
import { CategoryDonut } from "./charts/CategoryDonut";

type Data = Awaited<ReturnType<typeof vendorSpendReport>>;

export function VendorSpendDoc({ orgName, data }: { orgName: string; data: Data }) {
  return (
    <ReportDoc
      orgName={orgName}
      title="Vendor Spend"
      periodLabel={`${fmtDate(data.from)} – ${fmtDate(data.to)}`}
    >
      <div className="mt-4 flex gap-8 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Billed this period
          </div>
          <div className="font-medium tabular-nums">{peso(data.totalBilled)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Paid this period
          </div>
          <div className="font-medium tabular-nums">{peso(data.totalPaid)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Open balance
          </div>
          <div className="font-medium tabular-nums">{peso(data.openBalance)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-10">
        {data.topVendors.length > 0 && (
          <RankBarChart
            title="Top vendors by spend"
            note="By amount billed this period, top 10."
            data={data.topVendors}
            unit="peso"
          />
        )}
        {data.byCategory.length > 0 && (
          <CategoryDonut
            title="Spend by category"
            note="Grouped by the bill's expense account."
            data={data.byCategory}
          />
        )}
      </div>

      {data.vendors.length === 0 ? (
        <p className="mt-6 text-sm text-gray-400">
          No vendor bills in this period.
        </p>
      ) : (
        <table className="mt-4 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-2 pr-3 font-medium">Vendor</th>
              <th className="py-2 pr-3 font-medium">Category</th>
              <th className="py-2 pr-3 text-right font-medium">Total billed</th>
              <th className="py-2 pr-3 text-right font-medium">Total paid</th>
              <th className="py-2 pr-3 text-right font-medium">Open balance</th>
            </tr>
          </thead>
          <tbody>
            {data.vendors.map((v) => (
              <tr key={v.vendorId} className="border-b border-gray-100">
                <td className="py-1.5 pr-3">{v.vendorName}</td>
                <td className="py-1.5 pr-3">{v.category}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {peso(v.totalBilled)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {peso(v.totalPaid)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {peso(v.openBalance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 pr-3" colSpan={2}>
                Total
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(data.totalBilled)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(data.totalPaid)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {peso(data.openBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </ReportDoc>
  );
}
