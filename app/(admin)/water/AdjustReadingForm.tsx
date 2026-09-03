"use client";

import { useState } from "react";
import { adjustReadingAction } from "./actions";

/**
 * Inline "correct a billed reading" form. Over-billing becomes resident credit;
 * under-billing becomes a small extra invoice.
 */
export function AdjustReadingForm({
  readingId,
  current,
  pending,
  onDone,
  run,
}: {
  readingId: string;
  current: number;
  pending: boolean;
  onDone: () => void;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [value, setValue] = useState(String(current));
  const [reason, setReason] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const res = await adjustReadingAction({
            readingId,
            correctConsumption: value,
            reason,
          });
          if (res.ok) onDone();
          return res;
        });
      }}
      className="flex flex-wrap items-end gap-2 text-sm"
    >
      <span className="text-xs text-fg-muted">
        Correct this billed reading (was {current} m³):
      </span>
      <label className="block">
        <span className="text-xs text-fg-subtle">Correct m³</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          className="mt-1 block w-24 rounded-md border border-border px-2 py-1 text-right outline-none focus:border-brand"
        />
      </label>
      <label className="block flex-1">
        <span className="text-xs text-fg-subtle">Reason</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          placeholder="mis-read, meter fault…"
          className="mt-1 block w-full rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 hover:bg-surface disabled:opacity-50"
      >
        Adjust
      </button>
    </form>
  );
}
