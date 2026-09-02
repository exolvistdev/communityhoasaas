"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lateFeeSummary, type LateFeePolicy } from "@/lib/late-fee-policy";
import { updateLateFeeSettings } from "./actions";

export function LateFeeSettingsForm({ policy }: { policy: LateFeePolicy }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [p, setP] = useState<LateFeePolicy>(policy);
  const set = <K extends keyof LateFeePolicy>(k: K, v: LateFeePolicy[K]) => {
    setP((cur) => ({ ...cur, [k]: v }));
    setSaved(false);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateLateFeeSettings(p);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  const field =
    "mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={p.lateFeeEnabled}
          onChange={(e) => set("lateFeeEnabled", e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-fg">Charge late fees on overdue dues</span>
      </label>

      <fieldset
        disabled={!p.lateFeeEnabled}
        className="space-y-3 disabled:opacity-50"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-fg">Fee type</span>
            <select
              value={p.lateFeeType}
              onChange={(e) =>
                set("lateFeeType", e.target.value as LateFeePolicy["lateFeeType"])
              }
              className={field}
            >
              <option value="FIXED">Flat peso amount</option>
              <option value="PERCENT">Percent of the overdue balance</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-fg">
              {p.lateFeeType === "PERCENT" ? "Percentage (%)" : "Amount (₱)"}
            </span>
            <input
              type="number"
              min="0"
              step={p.lateFeeType === "PERCENT" ? "0.5" : "1"}
              value={p.lateFeeAmount}
              onChange={(e) =>
                set("lateFeeAmount", Number(e.target.value) || 0)
              }
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="text-fg">Grace period (days)</span>
            <input
              type="number"
              min="0"
              max="90"
              value={p.lateFeeGraceDays}
              onChange={(e) =>
                set("lateFeeGraceDays", Number(e.target.value) || 0)
              }
              className={field}
            />
            <span className="mt-1 block text-xs text-fg-subtle">
              Days after the due date before a fee applies.
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-fg">Charge up to</span>
            <input
              type="number"
              min="1"
              max="12"
              value={p.lateFeeMaxOccurrences}
              onChange={(e) =>
                set(
                  "lateFeeMaxOccurrences",
                  Math.max(1, Number(e.target.value) || 1)
                )
              }
              className={field}
            />
            <span className="mt-1 block text-xs text-fg-subtle">
              Times per overdue invoice (once a month while it stays unpaid).
            </span>
          </label>
        </div>
      </fieldset>

      <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-muted">
        {lateFeeSummary(p)}
      </p>

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
