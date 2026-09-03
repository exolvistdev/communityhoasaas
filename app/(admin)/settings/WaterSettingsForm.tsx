"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import {
  computeWaterCharge,
  validateBands,
  type RateBand,
} from "@/lib/water";
import { updateWaterConfig } from "./actions";

export function WaterSettingsForm({
  config,
}: {
  config: { enabled: boolean; serviceCharge: number; bands: RateBand[] };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(config.enabled);
  const [serviceCharge, setServiceCharge] = useState(config.serviceCharge);
  const [bands, setBands] = useState<RateBand[]>(
    config.bands.length
      ? config.bands
      : [
          { upToM3: 10, pricePerM3: 20 },
          { upToM3: null, pricePerM3: 45 },
        ]
  );

  const dirty = () => setSaved(false);

  const setBand = (i: number, patch: Partial<RateBand>) => {
    setBands((cur) => cur.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    dirty();
  };
  const addBand = () => {
    setBands((cur) => {
      const next = [...cur];
      const last = next[next.length - 1];
      // give the previously-open band a cap, append a new open band
      const cap = last.upToM3 ?? (next.length > 1 ? (next[next.length - 2].upToM3 ?? 0) + 10 : 10);
      next[next.length - 1] = { ...last, upToM3: cap };
      next.push({ upToM3: null, pricePerM3: last.pricePerM3 + 10 });
      return next;
    });
    dirty();
  };
  const removeBand = (i: number) => {
    setBands((cur) => {
      if (cur.length <= 1) return cur;
      const next = cur.filter((_, j) => j !== i);
      next[next.length - 1] = { ...next[next.length - 1], upToM3: null };
      return next;
    });
    dirty();
  };

  const problems = enabled ? validateBands(bands) : [];
  const preview = [5, 15, 30].map((m3) => ({
    m3,
    amount: computeWaterCharge(m3, bands, serviceCharge),
  }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateWaterConfig({
        waterBillingEnabled: enabled,
        waterServiceCharge: serviceCharge,
        waterRateBands: bands,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  const field =
    "w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            dirty();
          }}
          className="h-4 w-4"
        />
        <span className="text-fg">Bill residents for metered water use</span>
      </label>

      <fieldset disabled={!enabled} className="space-y-3 disabled:opacity-50">
        <label className="block text-sm">
          <span className="text-fg">Fixed service charge (₱ / month)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={serviceCharge}
            onChange={(e) => {
              setServiceCharge(Number(e.target.value) || 0);
              dirty();
            }}
            className={`mt-1 ${field}`}
          />
        </label>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Rate bands (₱ per m³)
          </div>
          <div className="space-y-2">
            {bands.map((b, i) => {
              const last = i === bands.length - 1;
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-fg-subtle">
                    {i === 0 ? "0" : bands[i - 1].upToM3 ?? "—"} –
                  </span>
                  {last ? (
                    <span className="w-20 text-fg-muted">above</span>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={b.upToM3 ?? ""}
                      onChange={(e) =>
                        setBand(i, { upToM3: Number(e.target.value) || 0 })
                      }
                      className={`w-20 ${field}`}
                    />
                  )}
                  <span className="text-fg-subtle">m³ @ ₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={b.pricePerM3}
                    onChange={(e) =>
                      setBand(i, { pricePerM3: Number(e.target.value) || 0 })
                    }
                    className={`w-24 ${field}`}
                  />
                  {bands.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBand(i)}
                      className="text-xs text-danger-fg hover:underline"
                    >
                      remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addBand}
            className="mt-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
          >
            + add a band
          </button>
        </div>

        <div className="rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-muted">
          Example bills:{" "}
          {preview.map((p, i) => (
            <span key={p.m3}>
              {i > 0 && " · "}
              {p.m3} m³ → {peso(p.amount)}
            </span>
          ))}
        </div>
      </fieldset>

      {problems.length > 0 && (
        <p className="text-sm text-danger-fg">{problems[0]}</p>
      )}
      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || problems.length > 0}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending && <span className="text-sm text-success-fg">Saved</span>}
      </div>
    </form>
  );
}
