"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closeConversation,
  reopenConversation,
  resolveConversationReports,
} from "../actions";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong");
    });
  };
  return { pending, error, run };
}

export function ConversationModeration({
  id,
  closed,
  hasOpenReports,
}: {
  id: string;
  closed: boolean;
  hasOpenReports: boolean;
}) {
  const { pending, error, run } = useAction();
  const [closing, setClosing] = useState(false);

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex flex-wrap gap-2">
        {closed ? (
          <button
            onClick={() => run(() => reopenConversation(id))}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
          >
            Reopen conversation
          </button>
        ) : (
          <button
            onClick={() => setClosing((v) => !v)}
            className="rounded-md border border-danger/30 px-3 py-1.5 text-sm font-medium text-danger-fg hover:bg-danger-subtle"
          >
            Close conversation
          </button>
        )}
        {hasOpenReports && (
          <button
            onClick={() => run(() => resolveConversationReports(id))}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
          >
            Dismiss reports
          </button>
        )}
      </div>

      {closing && !closed && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const reason = new FormData(e.currentTarget).get("reason");
            run(() => closeConversation(id, reason));
          }}
          className="space-y-2 rounded-md border border-border bg-surface p-3"
        >
          <label className="block text-sm text-fg">
            Reason (both participants see this)
            <input
              name="reason"
              required
              maxLength={500}
              className="mt-1 w-full rounded-md border border-border px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
          </label>
          <button
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Closing…" : "Confirm close"}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
