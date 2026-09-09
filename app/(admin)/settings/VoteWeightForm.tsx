"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VoteWeightMode } from "@prisma/client";
import { updateVoteWeightMode } from "./actions";

const OPTIONS: { value: VoteWeightMode; label: string; hint: string }[] = [
  {
    value: "ONE_UNIT_ONE_VOTE",
    label: "One unit, one vote",
    hint: "Every unit in good standing counts equally (RA 9904 default).",
  },
  {
    value: "BY_FLOOR_AREA",
    label: "By floor area",
    hint: "Each unit's vote is weighted by its floor area — the RA 4726 norm for condominiums.",
  },
  {
    value: "BY_COMMON_SHARE",
    label: "By common-area share",
    hint: "Weighted by the master-deed appurtenant interest, falling back to floor area where no share is set.",
  },
];

export function VoteWeightForm({
  current,
  unitsMissingFigure = 0,
}: {
  current: VoteWeightMode;
  /** units with no floor area / share — they'd carry 0 weight */
  unitsMissingFigure?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [value, setValue] = useState<VoteWeightMode>(current);

  const weighted = value !== "ONE_UNIT_ONE_VOTE";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateVoteWeightMode({ voteWeightMode: value });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-lg border border-border bg-surface p-4"
    >
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer gap-2.5 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
        >
          <input
            type="radio"
            name="voteWeightMode"
            value={o.value}
            checked={value === o.value}
            onChange={() => {
              setValue(o.value);
              setSaved(false);
            }}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-fg">{o.label}</span>
            <span className="block text-xs text-fg-muted">{o.hint}</span>
          </span>
        </label>
      ))}

      {weighted && unitsMissingFigure > 0 && (
        <p className="rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning-fg">
          {unitsMissingFigure} unit{unitsMissingFigure === 1 ? "" : "s"} in good
          standing {unitsMissingFigure === 1 ? "has" : "have"} no floor area — they
          would carry no voting weight until it&apos;s entered.
        </p>
      )}
      {weighted && (
        <p className="text-xs text-fg-subtle">
          Quorum percentages then apply to total voting weight, not the number of
          units.
        </p>
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending || value === current}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending && <span className="text-sm text-success-fg">Saved</span>}
      </div>
    </form>
  );
}
