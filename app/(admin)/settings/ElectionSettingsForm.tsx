"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateElectionSettings } from "./actions";

export function ElectionSettingsForm({
  electionArrearsMonths,
}: {
  electionArrearsMonths: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [months, setMonths] = useState(String(electionArrearsMonths));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateElectionSettings({ electionArrearsMonths: months });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <label className="block text-sm">
        <span className="text-fg">Suspend voting rights after</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="24"
            value={months}
            onChange={(e) => {
              setMonths(e.target.value);
              setSaved(false);
            }}
            className="w-20 rounded-md border border-border px-2 py-1.5 text-right outline-none focus:border-brand"
          />
          <span className="text-sm text-fg-muted">months of unpaid dues</span>
        </div>
        <span className="mt-1 block text-xs text-fg-subtle">
          A unit this many monthly dues invoices past due can&apos;t cast a ballot or
          field a candidate, on both resolution votes and board elections. Set to 0 to
          turn the rule off.
        </span>
      </label>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending && <span className="text-sm text-success-fg">Saved</span>}
      </div>
    </form>
  );
}
