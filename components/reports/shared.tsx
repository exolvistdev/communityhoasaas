import { peso } from "@/lib/format";

/**
 * Horizontal-scroll box for a report table on narrow screens — same pattern
 * as `charts/ChartFrame.tsx` (which does this for charts). Report tables
 * otherwise overflow `ReportDoc`'s fixed padding on phone-width viewports;
 * `print:overflow-visible` keeps the printed/PDF version unclipped. `min-w-0`
 * so this still works if a table is ever placed inside a flex row (see the
 * `min-w-0` note on `ChartFrame` — a flex item's default `min-width: auto`
 * otherwise defeats `overflow-x-auto`).
 */
export function TableFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 overflow-x-auto print:overflow-visible">
      {children}
    </div>
  );
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });

/** Shared "document" frame — white ground, print-friendly gray text. */
export function ReportDoc({
  orgName,
  title,
  periodLabel,
  children,
}: {
  orgName: string;
  title: string;
  periodLabel: string;
  children: React.ReactNode;
}) {
  return (
    <article className="bg-white p-8 text-sm text-gray-900 print:p-0">
      <header className="flex items-start justify-between border-b border-gray-300 pb-4">
        <div>
          <div className="text-base font-semibold">{orgName}</div>
          <div className="text-gray-500">{title}</div>
        </div>
        <div className="text-right text-gray-500">{periodLabel}</div>
      </header>
      {children}
    </article>
  );
}

/** A labelled section with rows of `{ name, amount }` and a total. */
export function AmountSection({
  heading,
  rows,
  total,
  totalLabel = "Total",
}: {
  heading: string;
  rows: { code?: string; name: string; amount: number }[];
  total: number;
  totalLabel?: string;
}) {
  return (
    <div className="mt-6">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {heading}
      </div>
      <TableFrame>
        <table className="w-full border-collapse">
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="py-1.5 text-gray-400" colSpan={2}>
                  None in this period.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 pr-4">
                  {r.code ? (
                    <span className="mr-2 font-mono text-xs text-gray-400">
                      {r.code}
                    </span>
                  ) : null}
                  {r.name}
                </td>
                <td className="py-1.5 text-right tabular-nums">{peso(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-1.5 pr-4">{totalLabel}</td>
              <td className="py-1.5 text-right tabular-nums">{peso(total)}</td>
            </tr>
          </tfoot>
        </table>
      </TableFrame>
    </div>
  );
}
