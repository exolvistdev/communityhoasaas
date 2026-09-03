"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VoteChoice } from "@prisma/client";
import { VOTE_CHOICES } from "@/lib/vote";
import { castBallot } from "./actions";

export function BallotForm({
  voteId,
  propertyId,
  unitLabel,
  current,
}: {
  voteId: string;
  propertyId: string;
  unitLabel: string;
  current: VoteChoice | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(choice: VoteChoice) {
    setError(null);
    start(async () => {
      const res = await castBallot(voteId, { propertyId, choice });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-1.5 text-xs font-medium text-fg-muted">{unitLabel}</div>
      <div className="flex gap-2">
        {VOTE_CHOICES.map((o) => (
          <button
            key={o.value}
            onClick={() => choose(o.value)}
            disabled={pending}
            className={`flex-1 rounded-md border px-2 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              current === o.value
                ? "border-brand bg-brand text-white"
                : "border-border bg-surface text-fg-muted hover:bg-surface-2"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {current && (
        <p className="mt-1 text-xs text-fg-subtle">
          Ballot recorded — you can change it while voting is open.
        </p>
      )}
      {error && <p className="mt-1 text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
