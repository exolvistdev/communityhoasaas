import { peso } from "@/lib/format";
import type { Statement } from "@/lib/soa";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function StatementDocument({ statement: s }: { statement: Statement }) {
  return (
    <article className="bg-white p-8 text-sm text-gray-900 print:p-0">
      <header className="flex items-start justify-between border-b border-gray-300 pb-4">
        <div>
          <div className="text-base font-semibold">{s.orgName}</div>
          <div className="text-gray-500">Statement of Account</div>
        </div>
        <div className="text-right text-gray-500">
          <div>Statement date: {fmtDate(s.statementDate)}</div>
          <div>
            {s.from
              ? `${fmtDate(s.from)} – ${fmtDate(s.to)}`
              : `All activity through ${fmtDate(s.to)}`}
          </div>
        </div>
      </header>

      <div className="mt-4 flex gap-8">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">Unit</div>
          <div className="font-medium">{s.unitNumber}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Homeowner
          </div>
          <div className="font-medium">{s.homeownerName ?? "—"}</div>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-300 text-left text-gray-500">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Description</th>
            <th className="py-2 pr-4 text-right font-medium">Charges</th>
            <th className="py-2 pr-4 text-right font-medium">Payments</th>
            <th className="py-2 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100 text-gray-500">
            <td className="py-2 pr-4" colSpan={4}>
              Opening balance
            </td>
            <td className="py-2 text-right">{peso(s.openingBalance)}</td>
          </tr>
          {s.lines.map((l, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(l.date)}</td>
              <td className="py-2 pr-4">{l.description}</td>
              <td className="py-2 pr-4 text-right">
                {l.charge ? peso(l.charge) : ""}
              </td>
              <td className="py-2 pr-4 text-right">
                {l.payment ? peso(l.payment) : ""}
              </td>
              <td className="py-2 text-right">{peso(l.balance)}</td>
            </tr>
          ))}
          {s.lines.length === 0 && (
            <tr>
              <td className="py-4 text-gray-400" colSpan={5}>
                No activity in this period.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 font-semibold">
            <td className="py-2 pr-4" colSpan={4}>
              Amount due
            </td>
            <td className="py-2 text-right">{peso(s.closingBalance)}</td>
          </tr>
          {s.creditBalance > 0.005 && (
            <tr className="text-gray-500">
              <td className="py-2 pr-4" colSpan={4}>
                Credit on file (applied to future dues)
              </td>
              <td className="py-2 text-right">{peso(s.creditBalance)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      {s.refunds.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          <span className="font-medium text-gray-600">Refunds</span>
          {s.refunds.map((r, i) => (
            <span key={i}>
              {fmtDate(r.date)} · {peso(r.amount)} ({r.method.replace("_", " ").toLowerCase()})
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
        <span className="font-medium text-gray-600">Aging</span>
        <span>Current {peso(s.aging.current)}</span>
        <span>1–30 {peso(s.aging.d1_30)}</span>
        <span>31–60 {peso(s.aging.d31_60)}</span>
        <span>61–90 {peso(s.aging.d61_90)}</span>
        <span>90+ {peso(s.aging.d90plus)}</span>
      </div>
    </article>
  );
}
