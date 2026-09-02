import { peso } from "@/lib/format";

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
    </div>
  );
}
