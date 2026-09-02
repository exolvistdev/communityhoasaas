import { peso } from "@/lib/format";
import type { collectionsSummary } from "@/lib/reports";
import { ReportDoc, fmtDate } from "./shared";

type Data = Awaited<ReturnType<typeof collectionsSummary>>;

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank transfer",
  GCASH: "GCash",
  MAYA: "Maya",
  WRITE_OFF: "Write-off",
};

export function CollectionsDoc({
  orgName,
  data,
}: {
  orgName: string;
  data: Data;
}) {
  const Line = ({
    label,
    value,
    strong,
  }: {
    label: string;
    value: number;
    strong?: boolean;
  }) => (
    <tr className={strong ? "border-t-2 border-gray-300 font-semibold" : ""}>
      <td className="py-1.5 pr-4">{label}</td>
      <td className="py-1.5 text-right tabular-nums">{peso(value)}</td>
    </tr>
  );

  return (
    <ReportDoc
      orgName={orgName}
      title="Collections Summary"
      periodLabel={`${fmtDate(data.from)} – ${fmtDate(data.to)}`}
    >
      <table className="mt-6 w-full border-collapse">
        <tbody>
          <Line label="Receivables at start of period" value={data.openingAR} />
          <Line label="Dues billed" value={data.duesBilled} />
          <Line label="Late fees billed" value={data.lateFeesBilled} />
          {Math.abs(data.otherBilled) > 0.005 && (
            <Line label="Other charges billed" value={data.otherBilled} />
          )}
          <Line label="Payments collected" value={-data.collected} />
          <Line
            label="Receivables at end of period"
            value={data.closingAR}
            strong
          />
        </tbody>
      </table>

      {data.collectionRate != null && (
        <p className="mt-4 text-sm text-gray-600">
          Collection rate:{" "}
          <span className="font-semibold">
            {(data.collectionRate * 100).toFixed(1)}%
          </span>{" "}
          of amounts owed during the period.
        </p>
      )}

      {data.byMethod.length > 0 && (
        <>
          <div className="mt-6 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Payments by method
          </div>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {data.byMethod.map((m) => (
                <tr key={m.method} className="border-b border-gray-100">
                  <td className="py-1.5 pr-4">
                    {METHOD_LABEL[m.method] ?? m.method}
                    <span className="ml-2 text-xs text-gray-400">
                      {m.count} payment{m.count === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {peso(m.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ReportDoc>
  );
}
