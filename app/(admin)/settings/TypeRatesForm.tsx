"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DuesRateMode } from "@prisma/client";
import { peso } from "@/lib/format";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABEL } from "@/lib/rate";
import { updateTypeRates, reapplyTypeRate, reapplyPerSqmRate } from "./actions";

type PropertyType = (typeof PROPERTY_TYPES)[number];

type Row = {
  type: PropertyType;
  rate: number | null;
  offPlan: number; // non-plan properties of this type not currently on the default
};

export function TypeRatesForm({
  rows,
  duesRateMode: initialMode,
  duesRatePerSqm,
  perSqmOffRate = 0,
}: {
  rows: Row[];
  duesRateMode: DuesRateMode;
  duesRatePerSqm: number | null;
  /** non-plan units with a floor area whose rate ≠ duesRatePerSqm × floorArea */
  perSqmOffRate?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reapplying, startReapply] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<DuesRateMode>(initialMode);
  const [perSqm, setPerSqm] = useState(
    duesRatePerSqm != null ? String(duesRatePerSqm) : ""
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateTypeRates({
        duesRateMode: mode,
        duesRatePerSqm: mode === "PER_SQM" ? perSqm : "",
        typeRateResidential: fd.get("RESIDENTIAL"),
        typeRateCommercial: fd.get("COMMERCIAL"),
        typeRateTownhouse: fd.get("TOWNHOUSE"),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  function reapply(type: PropertyType) {
    setError(null);
    startReapply(async () => {
      const res = await reapplyTypeRate(type);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function reapplySqm() {
    setError(null);
    startReapply(async () => {
      const res = await reapplyPerSqmRate();
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap gap-2 text-sm">
        {(["BY_TYPE", "PER_SQM"] as const).map((m) => (
          <label
            key={m}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
          >
            <input
              type="radio"
              name="mode"
              checked={mode === m}
              onChange={() => {
                setMode(m);
                setSaved(false);
              }}
            />
            {m === "BY_TYPE" ? "By property type" : "Per square metre"}
          </label>
        ))}
      </div>

      {mode === "PER_SQM" ? (
        <div className="space-y-2">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-28 text-fg">Rate</span>
            <span className="text-fg-subtle">₱</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={perSqm}
              onChange={(e) => {
                setPerSqm(e.target.value);
                setSaved(false);
              }}
              className="w-32 rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
            <span className="text-fg-subtle">/ sqm / month</span>
          </label>
          {perSqmOffRate > 0 && (
            <button
              type="button"
              onClick={reapplySqm}
              disabled={reapplying}
              className="text-xs text-fg-muted underline hover:text-fg disabled:opacity-50"
            >
              {perSqmOffRate} unit{perSqmOffRate === 1 ? "" : "s"} on a different
              rate · re-apply ₱{perSqm || "0"}/sqm
            </button>
          )}
          <p className="text-xs text-fg-subtle">
            A unit&apos;s dues become ₱/sqm × its floor area. Units without a
            floor area fall back to the by-type default.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.type}
              className="flex flex-wrap items-center gap-3 text-sm"
            >
              <span className="w-28 text-fg">
                {PROPERTY_TYPE_LABEL[r.type]}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-fg-subtle">₱</span>
                <input
                  name={r.type}
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={r.rate ?? ""}
                  placeholder="none"
                  className="w-32 rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
                />
              </div>
              {r.rate != null && r.offPlan > 0 && (
                <button
                  type="button"
                  onClick={() => reapply(r.type)}
                  disabled={reapplying}
                  className="text-xs text-fg-muted underline hover:text-fg disabled:opacity-50"
                >
                  {r.offPlan} on a different rate · re-apply {peso(r.rate)}
                </button>
              )}
            </div>
          ))}
          <p className="text-xs text-fg-subtle">
            Used when a unit has neither a rate plan nor a custom rate. Leave
            blank for no default. Changing a value here doesn&apos;t touch
            existing units until you re-apply it.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-success-fg">Saved</span>
        )}
      </div>
    </form>
  );
}
