"use client";

import { useState, useTransition } from "react";
import { startImpersonation } from "@/app/platform/actions";

export function ImpersonateButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={() => {
          if (!confirm(`Sign in as ${userName}? This is logged.`)) return;
          start(async () => {
            const res = await startImpersonation(userId);
            // On success the action redirects; we only get here on failure.
            if (res && !res.ok) setError(res.error);
          });
        }}
        disabled={pending}
        className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs text-fg hover:brightness-125 disabled:opacity-50"
      >
        {pending ? "…" : "Impersonate"}
      </button>
      {error && <span className="text-xs text-danger-fg">{error}</span>}
    </div>
  );
}
