import Link from "next/link";
import { redirect } from "next/navigation";
import { getHomeownerContext } from "@/lib/portal";
import { peso, periodLabel } from "@/lib/format";
import { formatConsumption, waterMetered } from "@/lib/water";
import { residentWaterHistory } from "@/lib/water-billing";
import { MonthlyBarChart } from "@/components/reports/charts/MonthlyBarChart";

export const metadata = { title: "Water · HOA SaaS" };

const STATUS_LABEL: Record<string, string> = {
  SENT: "Billed",
  PARTIALLY_PAID: "Part-paid",
  PAID: "Paid",
  DRAFT: "Draft",
  VOID: "Void",
};

export default async function PortalWaterPage() {
  const { property, org } = await getHomeownerContext();
  if (!waterMetered(org.waterSource)) redirect("/portal");

  if (!property)
    return (
      <p className="text-sm text-fg-muted">
        Your account isn&apos;t linked to a unit yet.
      </p>
    );

  const history = await residentWaterHistory(property.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
          ← Portal
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-fg">Water</h1>
        <p className="text-sm text-fg-muted">
          Your meter readings and water charges.
          {history?.serialNumber ? ` Meter #${history.serialNumber}.` : ""}
        </p>
      </div>

      {!history || history.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-fg-muted">
          No water readings on record for your unit yet.
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-white p-3">
            <MonthlyBarChart
              title="Your consumption by month"
              note="Metered use, most recent 12 readings."
              data={history.rows.map((r) => ({
                label: periodLabel(r.period),
                value: r.consumption,
              }))}
              unit="m3"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-fg-subtle">
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 text-right font-medium">Reading</th>
                  <th className="px-3 py-2 text-right font-medium">Used</th>
                  <th className="px-3 py-2 text-right font-medium">Charge</th>
                  <th className="px-3 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...history.rows].reverse().map((r) => (
                  <tr
                    key={r.period}
                    className="border-t border-border align-top first:border-t-0"
                  >
                    <td className="px-3 py-2 text-fg">{periodLabel(r.period)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-fg-muted">
                      {r.currentReading}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatConsumption(r.consumption)}
                      {r.flag === "low" && (
                        <span className="ml-1 text-xs text-warning-fg">⚠</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="tabular-nums">
                        {r.status ? peso(r.amount) : "—"}
                      </div>
                      {r.breakdown && (
                        <div className="text-xs text-fg-subtle">{r.breakdown}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-fg-muted">
                      {r.status ? STATUS_LABEL[r.status] ?? r.status : "Pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-fg-subtle">
            Water charges are billed as a separate line on your{" "}
            <Link href="/portal/pay" className="text-brand-accent underline">
              statement
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
