"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { castElectionBallot } from "./actions";

type Candidate = { id: string; name: string; bio: string | null };

export function CandidateChecklist({
  electionId,
  propertyId,
  unitLabel,
  seats,
  candidates,
  current, // candidateIds already picked; empty = not voted or abstained
  abstained,
}: {
  electionId: string;
  propertyId: string;
  unitLabel: string;
  seats: number;
  candidates: Candidate[];
  current: string[];
  abstained: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set(current));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const hasBallot = current.length > 0 || abstained;
  const atLimit = picked.size >= seats;
  const dirty = useMemo(() => {
    if (picked.size !== current.length) return true;
    return current.some((id) => !picked.has(id));
  }, [picked, current]);

  function toggle(id: string) {
    setError(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < seats) next.add(id);
      return next;
    });
  }

  function submit(candidateIds: string[]) {
    setError(null);
    start(async () => {
      const res = await castElectionBallot(electionId, { propertyId, candidateIds });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-fg-muted">{unitLabel}</span>
        <span className={atLimit ? "text-warning-fg" : "text-fg-subtle"}>
          {picked.size} of {seats} selected
        </span>
      </div>

      <div className="space-y-1.5">
        {candidates.map((c) => {
          const on = picked.has(c.id);
          return (
            <label
              key={c.id}
              className={`flex cursor-pointer gap-2 rounded-md border p-2 text-sm ${
                on ? "border-brand bg-brand-subtle" : "border-border bg-surface"
              } ${!on && atLimit ? "opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={pending || (!on && atLimit)}
                onChange={() => toggle(c.id)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-fg">{c.name}</span>
                {c.bio && (
                  <span className="block text-xs text-fg-subtle">{c.bio}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => submit([...picked])}
          disabled={pending || (hasBallot && !dirty) || picked.size === 0}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : hasBallot ? "Update ballot" : "Submit ballot"}
        </button>
        <button
          onClick={() => {
            setPicked(new Set());
            submit([]);
          }}
          disabled={pending}
          className="rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-2 disabled:opacity-50"
        >
          Abstain
        </button>
      </div>

      {hasBallot && (
        <p className="mt-1 text-xs text-fg-subtle">
          {abstained
            ? "You abstained — you can still pick candidates while voting is open."
            : "Ballot recorded — you can change it while voting is open."}
        </p>
      )}
      {error && <p className="mt-1 text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
