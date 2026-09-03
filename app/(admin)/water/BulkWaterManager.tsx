"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso, periodLabel } from "@/lib/format";
import { formatConsumption } from "@/lib/water";
import type { MeterRow } from "@/lib/water-billing";
import {
  addSourceMeter,
  saveReadings,
  billBulkPeriod,
  previewBulkAction,
  retireMeterAction,
} from "./actions";

type BulkData = {
  source: MeterRow | null;
  units: MeterRow[];
  period: string;
  unbilledForPeriod: number;
  alreadyBilled: boolean;
  lossPolicy: "DISTRIBUTE" | "ABSORB";
  adminFeeFlat: number;
  vendor: { id: string; name: string; archived: boolean } | null;
  runs: {
    id: string;
    period: string;
    bulkAmount: number;
    sourceConsumption: number;
    meteredConsumption: number;
    systemLoss: number;
    effectiveRate: number;
    lossPolicy: string;
    unitsBilled: number;
    billStatus: string | null;
  }[];
};

type Preview = {
  alloc: {
    effectiveRate: number;
    meteredConsumption: number;
    sourceConsumption: number;
    systemLoss: number;
    systemLossPct: number;
    residentTotal: number;
    shortfall: number;
    error?: string;
  };
  hasSource: boolean;
  rows: {
    unitId: string;
    unitNumber: string;
    consumption: number;
    billedConsumption: number;
    amount: number;
  }[];
  flagged: { unitNumber: string; currentReading: number; priorReading: number }[];
};

const priorOf = (m: MeterRow, period: string) =>
  m.latest ? m.latest.currentReading : m.initialReading;

export function BulkWaterManager({
  period,
  data,
}: {
  period: string;
  data: BulkData;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const m of [...(data.source ? [data.source] : []), ...data.units])
      seed[m.id] =
        m.latest?.period === period ? String(m.latest.currentReading) : "";
    return seed;
  });

  const [bulkAmount, setBulkAmount] = useState("");
  const [billDate, setBillDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [preview, setPreview] = useState<Preview | null>(null);

  const unitRows = useMemo(
    () =>
      data.units
        .filter((m) => !m.archived)
        .map((m) => {
          const prior = priorOf(m, period);
          const raw = inputs[m.id];
          const cur = raw === "" || raw == null ? null : Number(raw);
          const consumption =
            cur == null
              ? null
              : Math.max(0, Math.round((cur - prior) * 100) / 100);
          return {
            ...m,
            prior,
            cur,
            consumption,
            low: cur != null && cur < prior,
            thisPeriodBilled: m.latest?.period === period && m.latest.billed,
          };
        }),
    [data.units, inputs, period]
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
    const rows: { meterId: string; currentReading: number }[] = [];
    if (data.source && inputs[data.source.id] !== "" && inputs[data.source.id] != null)
      rows.push({
        meterId: data.source.id,
        currentReading: Number(inputs[data.source.id]),
      });
    for (const r of unitRows)
      if (r.cur != null && !r.thisPeriodBilled)
        rows.push({ meterId: r.id, currentReading: r.cur });
    if (rows.length === 0) {
      setError("Enter at least one reading.");
      return;
    }
    setPreview(null);
    run(() => saveReadings({ period, rows }));
  }

  function onPreview() {
    setError(null);
    const amt = Number(bulkAmount);
    if (!(amt > 0)) {
      setError("Enter the utility bill amount first.");
      return;
    }
    start(async () => {
      const res = await previewBulkAction({ period, bulkAmount: amt });
      if (res.ok) setPreview(res.preview as Preview);
      else setError(res.error ?? "Could not build the preview");
    });
  }

  function onBill() {
    const amt = Number(bulkAmount);
    if (!window.confirm(`Book the ₱${amt.toLocaleString()} utility bill and split it across the units?`))
      return;
    run(async () => {
      const res = await billBulkPeriod({ period, bulkAmount: amt, billDate });
      if (res.ok) setPreview(null);
      return res;
    });
  }

  const sourceInput = data.source && (
    <input
      type="number"
      min={data.source.latest ? undefined : data.source.initialReading}
      step="0.01"
      value={inputs[data.source.id] ?? ""}
      onChange={(e) =>
        setInputs((c) => ({ ...c, [data.source!.id]: e.target.value }))
      }
      className="w-32 rounded-md border border-border px-2 py-1 text-right outline-none focus:border-brand"
    />
  );

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-danger-fg">{error}</p>}

      {/* master meter */}
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">
          Master meter — {data.vendor?.name}
        </h2>
        {!data.source ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() =>
                addSourceMeter({
                  serialNumber: fd.get("serialNumber"),
                  initialReading: fd.get("initialReading"),
                })
              );
            }}
            className="flex flex-wrap items-end gap-2 text-sm"
          >
            <span className="text-xs text-fg-muted">
              Add the utility&apos;s master meter for the whole subdivision.
            </span>
            <label className="block">
              <span className="text-xs text-fg-subtle">Serial (optional)</span>
              <input
                name="serialNumber"
                className="mt-1 block rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="text-xs text-fg-subtle">Installed reading</span>
              <input
                name="initialReading"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className="mt-1 block w-32 rounded-md border border-border px-2 py-1 text-right outline-none focus:border-brand"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2 disabled:opacity-50"
            >
              Add master meter
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-fg-muted">
              {data.source.serialNumber
                ? `#${data.source.serialNumber}`
                : "no serial"}
            </span>
            <label className="flex items-center gap-2">
              <span className="text-xs text-fg-subtle">
                Prior {priorOf(data.source, period)} → this reading
              </span>
              {sourceInput}
            </label>
            {data.source.latest?.period === period && (
              <span className="text-xs text-fg-subtle">
                used {formatConsumption(data.source.latest.consumption)}
              </span>
            )}
            <button
              onClick={() => {
                if (window.confirm("Retire the master meter?"))
                  run(() => retireMeterAction(data.source!.id));
              }}
              disabled={pending}
              className="text-xs text-danger-fg hover:underline disabled:opacity-50"
            >
              retire
            </button>
          </div>
        )}
        <p className="text-xs text-fg-subtle">
          Loss policy:{" "}
          <span className="font-medium text-fg-muted">
            {data.lossPolicy === "DISTRIBUTE"
              ? "residents cover the whole bill"
              : "the HOA absorbs system loss"}
          </span>
          {data.adminFeeFlat > 0 && ` · ₱${data.adminFeeFlat} admin fee per unit`}
        </p>
      </section>

      {/* sub-meter readings */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">
            Sub-meter readings — {periodLabel(period)}
          </h2>
          <button
            onClick={onSaveReadings}
            disabled={pending}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save readings"}
          </button>
        </div>

        {unitRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">
            No sub-meters yet — switch to the internal view? Add units on the
            Properties page first, then meter them here.
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
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {unitRows.map((r) => (
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
                          setInputs((c) => ({ ...c, [r.id]: e.target.value }))
                        }
                        className="w-28 rounded-md border border-border px-2 py-1 text-right outline-none focus:border-brand disabled:opacity-50"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.consumption == null
                        ? "—"
                        : formatConsumption(r.consumption)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {r.low ? (
                        <span className="text-warning-fg">
                          ⚠ below prior — excluded until fixed
                        </span>
                      ) : r.thisPeriodBilled ? (
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

      {/* utility bill + allocation */}
      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">
          Utility bill for {periodLabel(period)}
        </h2>
        {data.alreadyBilled ? (
          <p className="text-sm text-success-fg">
            This period has been billed.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <label className="block">
                <span className="text-xs text-fg-subtle">Bill amount (₱)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bulkAmount}
                  onChange={(e) => {
                    setBulkAmount(e.target.value);
                    setPreview(null);
                  }}
                  className="mt-1 block w-40 rounded-md border border-border px-2 py-1.5 text-right outline-none focus:border-brand"
                />
              </label>
              <label className="block">
                <span className="text-xs text-fg-subtle">Bill date</span>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="mt-1 block rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
                />
              </label>
              <button
                onClick={onPreview}
                disabled={pending}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2 disabled:opacity-50"
              >
                Preview allocation
              </button>
            </div>

            {preview && !preview.alloc.error && (
              <div className="space-y-3">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md bg-surface-2 p-3 text-xs sm:grid-cols-3">
                  <Stat
                    label="Master meter"
                    value={
                      preview.hasSource
                        ? formatConsumption(preview.alloc.sourceConsumption)
                        : "no reading — split by sub-meter"
                    }
                  />
                  <Stat
                    label="Σ sub-meters"
                    value={formatConsumption(preview.alloc.meteredConsumption)}
                  />
                  <Stat
                    label="System loss"
                    value={`${formatConsumption(preview.alloc.systemLoss)} · ${preview.alloc.systemLossPct}%`}
                  />
                  <Stat
                    label="Effective rate"
                    value={`₱${preview.alloc.effectiveRate.toFixed(2)}/m³`}
                  />
                  <Stat
                    label="Resident total"
                    value={peso(preview.alloc.residentTotal)}
                  />
                  <Stat
                    label={
                      data.lossPolicy === "ABSORB" ? "HOA absorbs" : "vs. bill"
                    }
                    value={
                      data.lossPolicy === "ABSORB"
                        ? peso(preview.alloc.shortfall)
                        : peso(
                            preview.alloc.residentTotal - Number(bulkAmount)
                          )
                    }
                  />
                </dl>

                {preview.flagged.length > 0 && (
                  <p className="text-xs text-warning-fg">
                    Excluded (reading below prior):{" "}
                    {preview.flagged
                      .map((f) => `${f.unitNumber} (${f.currentReading} < ${f.priorReading})`)
                      .join(", ")}
                  </p>
                )}

                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-fg-subtle">
                        <th className="px-3 py-1.5 font-medium">Unit</th>
                        <th className="px-3 py-1.5 text-right font-medium">Used</th>
                        <th className="px-3 py-1.5 text-right font-medium">Billed m³</th>
                        <th className="px-3 py-1.5 text-right font-medium">Charge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.unitId} className="border-t border-border">
                          <td className="px-3 py-1.5 text-fg">{row.unitNumber}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {row.consumption}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {row.billedConsumption}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {peso(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={onBill}
                  disabled={pending}
                  className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
                >
                  Bill the period
                </button>
              </div>
            )}
            {preview?.alloc.error && (
              <p className="text-sm text-danger-fg">{preview.alloc.error}</p>
            )}
          </>
        )}
      </section>

      {/* history */}
      {data.runs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Past runs</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-fg-subtle">
                  <th className="px-3 py-1.5 font-medium">Period</th>
                  <th className="px-3 py-1.5 text-right font-medium">Bulk bill</th>
                  <th className="px-3 py-1.5 text-right font-medium">Loss</th>
                  <th className="px-3 py-1.5 text-right font-medium">₱/m³</th>
                  <th className="px-3 py-1.5 text-right font-medium">Units</th>
                  <th className="px-3 py-1.5 text-right font-medium">Bill</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-1.5 text-fg">{periodLabel(r.period)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {peso(r.bulkAmount)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatConsumption(r.systemLoss)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      ₱{r.effectiveRate.toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.unitsBilled}
                    </td>
                    <td className="px-3 py-1.5 text-right text-fg-subtle">
                      {r.billStatus ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="font-medium text-fg">{value}</dd>
    </div>
  );
}
