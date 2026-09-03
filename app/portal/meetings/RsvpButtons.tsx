"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RsvpResponse } from "@prisma/client";
import { RSVP_OPTIONS } from "@/lib/meeting";
import { setRsvp } from "./actions";

export function RsvpButtons({
  meetingId,
  current,
}: {
  meetingId: string;
  current: RsvpResponse | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(response: RsvpResponse) {
    setError(null);
    start(async () => {
      const res = await setRsvp(meetingId, { response });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-1.5 text-xs font-medium text-fg-muted">
        Will you attend?
      </div>
      <div className="flex gap-2">
        {RSVP_OPTIONS.map((o) => (
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
      {error && <p className="mt-1 text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
