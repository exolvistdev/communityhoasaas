"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso, periodLabel } from "@/lib/format";
import { computeWaterCharge, formatConsumption, type RateBand } from "@/lib/water";
import type { MeterRow } from "@/lib/water-billing";
import {
  addMeter,
  removeMeter,
  saveReadings,
  billPeriod,
  replaceMeter,
} from "./actions";
import { AdjustReadingForm } from "./AdjustReadingForm";

type Meter = MeterRow;

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
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [estimating, setEstimating] = useState<Record<string, boolean>>({});

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
            m.latest && m.latest.period < period
              ? m.latest.currentReading
              : m.latest
                ? m.latest.currentReading
                : m.initialReading;
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
      .filter(
        (r) =>
          !r.thisPeriodBilled && (estimating[r.id] || r.cur != null)
      )
      .map((r) =>
        estimating[r.id]
          ? { meterId: r.id, estimated: true }
          : { meterId: r.id, currentReading: r.cur as number }
      );
    if (payload.length === 0) {
      setError("Enter a reading, or tick Estimate.");
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
        initialReading: fd.get("initialReading"),
      })
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-danger-fg">{error}</p>}

      {/* readings entry */}
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-fg">
            Readings — {periodLabel(period)}
          </h2>
          <button
            onClick={onSaveReadings}
            disabled={pending}
            className="w-full rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Saving…" : "Save readings"}
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">
            No meters yet — add one below.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
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
                {rows.map((r) => {
                  const est = !!estimating[r.id];
                  const billedThisPeriod =
                    r.latest?.period === period && r.latest.billed;
                  return (
                  <Fragment key={r.id}>
                  <tr className="border-t border-border first:border-t-0">
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
                        value={est ? "" : inputs[r.id] ?? ""}
                        placeholder={est ? "estimate" : ""}
                        disabled={r.thisPeriodBilled || est}
                        onChange={(e) =>
                          setInputs((cur) => ({ ...cur, [r.id]: e.target.value }))
                        }
                        className="w-24 rounded-md border border-border px-2 py-1 text-right outline-none focus:border-brand disabled:opacity-50"
                      />
                      {!r.thisPeriodBilled && (
                        <label className="ml-2 inline-flex items-center gap-1 text-xs text-fg-subtle">
                          <input
                            type="checkbox"
                            checked={est}
                            onChange={(e) =>
                              setEstimating((c) => ({
                                ...c,
                                [r.id]: e.target.checked,
                              }))
                            }
                          />
                          est.
                        </label>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {est
                        ? "≈ avg"
                        : r.consumption == null
                          ? "—"
                          : formatConsumption(r.consumption)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {est || r.amount == null ? "—" : peso(r.amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {r.latest?.period === period && r.latest.flag === "low" ? (
                        <span className="text-warning-fg" title="Below the prior reading">
                          ⚠ below prior
                        </span>
                      ) : billedThisPeriod ? (
                        <span className="space-x-2">
                          <span className="text-success-fg">
                            billed{r.latest?.estimated ? " (est.)" : ""}
                          </span>
                          <button
                            onClick={() =>
                              setAdjustingId((c) =>
                                c === r.latest!.readingId
                                  ? null
                                  : r.latest!.readingId
                              )
                            }
                            className="text-brand-accent hover:underline"
                          >
                            {adjustingId === r.latest?.readingId
                              ? "cancel"
                              : "adjust"}
                          </button>
                        </span>
                      ) : r.latest?.period === period ? (
                        <span className="text-fg-subtle">
                          saved{r.latest.estimated ? " (est.)" : ""}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                  {billedThisPeriod && adjustingId === r.latest?.readingId && (
                    <tr className="border-t border-border bg-surface-2">
                      <td colSpan={6} className="px-3 py-3">
                        <AdjustReadingForm
                          readingId={r.latest.readingId}
                          current={r.latest.consumption}
                          pending={pending}
                          run={run}
                          onDone={() => setAdjustingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
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
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {meters.map((m) => (
                  <Fragment key={m.id}>
                  <tr className="border-t border-border first:border-t-0">
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
                      {!m.latest ? (
                        <button
                          onClick={() => run(() => removeMeter(m.id))}
                          disabled={pending}
                          className="text-xs text-danger-fg hover:underline disabled:opacity-50"
                        >
                          remove
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setReplacingId((cur) => (cur === m.id ? null : m.id))
                          }
                          disabled={pending}
                          className="text-xs text-brand-accent hover:underline disabled:opacity-50"
                        >
                          {replacingId === m.id ? "cancel" : "replace"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {replacingId === m.id && (
                    <tr className="border-t border-border bg-surface-2">
                      <td colSpan={4} className="px-3 py-3">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            run(async () => {
                              const res = await replaceMeter({
                                meterId: m.id,
                                serialNumber: fd.get("serialNumber"),
                                initialReading: fd.get("initialReading"),
                              });
                              if (res.ok) setReplacingId(null);
                              return res;
                            });
                          }}
                          className="flex flex-wrap items-end gap-2 text-sm"
                        >
                          <span className="text-xs text-fg-muted">
                            Retire this meter and install a new one on{" "}
                            {m.unitNumber}:
                          </span>
                          <label className="block">
                            <span className="text-xs text-fg-subtle">
                              New serial (optional)
                            </span>
                            <input
                              name="serialNumber"
                              className="mt-1 block rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs text-fg-subtle">
                              Installed reading
                            </span>
                            <input
                              name="initialReading"
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue="0"
                              required
                              className="mt-1 block w-28 rounded-md border border-border px-2 py-1 text-right outline-none focus:border-brand"
                            />
                          </label>
                          <button
                            type="submit"
                            disabled={pending}
                            className="rounded-md border border-border px-3 py-1.5 hover:bg-surface disabled:opacity-50"
                          >
                            Replace meter
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
            <label className="block">
              <span className="text-xs text-fg-subtle">
                Installed reading
              </span>
              <input
                name="initialReading"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className="mt-1 w-28 rounded-md border border-border px-2 py-1.5 text-right outline-none focus:border-brand"
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
