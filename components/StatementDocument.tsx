import { peso } from "@/lib/format";
import type { Statement } from "@/lib/soa";
import { ResponsiveTable } from "@/components/ui/responsive-table";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function StatementDocument({ statement: s }: { statement: Statement }) {
  return (
    <article className="force-light bg-white p-8 text-sm text-gray-900 print:p-0">
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

      <section className="mt-6">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 text-gray-500">
          <span>Opening balance</span>
          <span>{peso(s.openingBalance)}</span>
        </div>

        <ResponsiveTable
          plain
          rows={s.lines}
          rowKey={(_l, i) => String(i)}
          empty={
            <div className="px-4 py-4 text-gray-400">
              No activity in this period.
            </div>
          }
          columns={[
            {
              key: "date",
              header: "Date",
              className: "whitespace-nowrap",
              cell: (l) => fmtDate(l.date),
            },
            {
              key: "description",
              header: "Description",
              card: "title",
              cell: (l) => l.description,
            },
            {
              key: "charges",
              header: "Charges",
              align: "right",
              className: "whitespace-nowrap",
              cell: (l) => (l.charge ? peso(l.charge) : ""),
            },
            {
              key: "payments",
              header: "Payments",
              align: "right",
              className: "whitespace-nowrap",
              cell: (l) => (l.payment ? peso(l.payment) : ""),
            },
            {
              key: "balance",
              header: "Balance",
              align: "right",
              className: "whitespace-nowrap",
              cell: (l) => peso(l.balance),
            },
          ]}
        />

        <div className="flex items-center justify-between border-t-2 border-gray-300 px-4 py-2 font-semibold">
          <span>Amount due</span>
          <span>{peso(s.closingBalance)}</span>
        </div>
        {s.creditBalance > 0.005 && (
          <div className="flex items-center justify-between px-4 py-2 text-gray-500">
            <span>Credit on file (applied to future dues)</span>
            <span>{peso(s.creditBalance)}</span>
          </div>
        )}
      </section>

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
