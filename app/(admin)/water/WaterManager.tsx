"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso, periodLabel } from "@/lib/format";
import { computeWaterCharge, formatConsumption, type RateBand } from "@/lib/water";
import { addMeter, removeMeter, saveReadings, billPeriod } from "./actions";

type Meter = {
  id: string;
  propertyId: string;
  unitNumber: string;
  archived: boolean;
  serialNumber: string | null;
  latest: {
    period: string;
    currentReading: number;
    consumption: number;
    amount: number;
    billed: boolean;
  } | null;
};

export function WaterManager({
  period,
  config,
  meters,
  unmetered,
  preview,
}: {
  period: string;
  config: { serviceCharge: number; bands: RateBand[] };
  meters: Meter[];
  unmetered: { id: string; unitNumber: string }[];
  preview: { count: number; total: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // reading inputs, keyed by meterId
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      meters.map((m) => [
        m.id,
        m.latest?.period === period ? String(m.latest.currentReading) : "",
      ])
    )
  );

  const rows = useMemo(
    () =>
      meters
        .filter((m) => !m.archived)
        .map((m) => {
          const prior =
            m.latest && m.latest.period < period ? m.latest.currentReading : 0;
          const cur = inputs[m.id] === "" ? null : Number(inputs[m.id]);
          const consumption =
            cur == null ? null : Math.max(0, Math.round((cur - prior) * 100) / 100);
          const amount =
            consumption == null
              ? null
              : computeWaterCharge(consumption, config.bands, config.serviceCharge);
          return {
            ...m,
            prior,
            cur,
            consumption,
            amount,
            thisPeriodBilled: m.latest?.period === period && m.latest.billed,
          };
        }),
    [meters, inputs, period, config]
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong");
    });
  }

  function onSaveReadings() {
    const payload = rows
      .filter((r) => r.cur != null && !r.thisPeriodBilled)
      .map((r) => ({ meterId: r.id, currentReading: r.cur as number }));
    if (payload.length === 0) {
      setError("Enter at least one reading.");
      return;
    }
    run(() => saveReadings({ period, rows: payload }));
  }

  function onAddMeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    e.currentTarget.reset();
    run(() =>
      addMeter({
        propertyId: fd.get("propertyId"),
        serialNumber: fd.get("serialNumber"),
      })
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-danger-fg">{error}</p>}

      {/* readings entry */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">
            Readings — {periodLabel(period)}
          </h2>
          <button
            onClick={onSaveReadings}
            disabled={pending}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save readings"}
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">
            No meters yet — add one below.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-fg-subtle">
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 text-right font-medium">Prior</th>
                  <th className="px-3 py-2 text-right font-medium">This reading</th>
                  <th className="px-3 py-2 text-right font-medium">Used</th>
                  <th className="px-3 py-2 text-right font-medium">Charge</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border first:border-t-0">
                    <td className="px-3 py-2 text-fg">
                      {r.unitNumber}
                      {r.serialNumber && (
                        <span className="ml-2 text-xs text-fg-subtle">
                          #{r.serialNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-fg-muted">
                      {r.prior}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={r.prior}
                        step="0.01"
                        value={inputs[r.id] ?? ""}
                        disabled={r.thisPeriodBilled}
                        onChange={(e) =>
                          setInputs((cur) => ({ ...cur, [r.id]: e.target.value }))
                        }
                        className="w-24 rounded-md border border-border px-2 py-1 text-right outline-none focus:border-brand disabled:opacity-50"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.consumption == null ? "—" : formatConsumption(r.consumption)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.amount == null ? "—" : peso(r.amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {r.thisPeriodBilled ? (
                        <span className="text-success-fg">billed</span>
                      ) : r.latest?.period === period ? (
                        <span className="text-fg-subtle">saved</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* bill the period */}
      <section className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
        <div className="text-sm">
          <div className="font-medium text-fg">Bill {periodLabel(period)}</div>
          <div className="text-xs text-fg-muted">
            {preview.count > 0
              ? `${preview.count} unbilled reading${
                  preview.count === 1 ? "" : "s"
                } · ${peso(preview.total)} total`
              : "Nothing to bill — save readings first."}
          </div>
        </div>
        <button
          onClick={() => {
            if (!window.confirm(`Create ${preview.count} water invoice(s)?`)) return;
            run(() => billPeriod(period));
          }}
          disabled={pending || preview.count === 0}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          Generate invoices
        </button>
      </section>

      {/* meters */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-fg">Meters</h2>
        {meters.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {meters.map((m) => (
                  <tr key={m.id} className="border-t border-border first:border-t-0">
                    <td className="px-3 py-2 text-fg">
                      {m.unitNumber}
                      {m.archived && (
                        <span className="ml-2 text-xs text-fg-subtle">
                          (unit archived)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-fg-muted">
                      {m.serialNumber ? `#${m.serialNumber}` : "no serial"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {m.latest
                        ? `last read ${periodLabel(m.latest.period)}`
                        : "never read"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!m.latest && (
                        <button
                          onClick={() => run(() => removeMeter(m.id))}
                          disabled={pending}
                          className="text-xs text-danger-fg hover:underline disabled:opacity-50"
                        >
                          remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {unmetered.length > 0 ? (
          <form
            onSubmit={onAddMeter}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3 text-sm"
          >
            <label className="block">
              <span className="text-xs text-fg-subtle">Unit</span>
              <select
                name="propertyId"
                className="mt-1 rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
              >
                {unmetered.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.unitNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-fg-subtle">Serial (optional)</span>
              <input
                name="serialNumber"
                className="mt-1 rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2 disabled:opacity-50"
            >
              Add meter
            </button>
          </form>
        ) : (
          <p className="text-xs text-fg-subtle">Every active unit has a meter.</p>
        )}
      </section>
    </div>
  );
}
