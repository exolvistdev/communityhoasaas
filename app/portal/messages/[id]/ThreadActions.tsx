"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockUser, unblockUser, reportConversation } from "../actions";

export function ThreadActions({
  conversationId,
  otherUserId,
  otherName,
  iBlocked,
  alreadyReported,
}: {
  conversationId: string;
  otherUserId: string;
  otherName: string;
  iBlocked: boolean;
  alreadyReported: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(alreadyReported);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong");
    });
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex gap-3">
        {iBlocked ? (
          <button
            onClick={() => run(() => unblockUser(otherUserId))}
            disabled={pending}
            className="text-fg-muted underline hover:text-fg"
          >
            Unblock {otherName.split(" ")[0]}
          </button>
        ) : (
          <button
            onClick={() => {
              if (!confirm(`Block ${otherName}? They won't be able to message you.`))
                return;
              run(() => blockUser(otherUserId));
            }}
            disabled={pending}
            className="text-fg-muted underline hover:text-fg"
          >
            Block {otherName.split(" ")[0]}
          </button>
        )}
        {!reported && !reporting && (
          <button
            onClick={() => setReporting(true)}
            className="text-fg-muted underline hover:text-fg"
          >
            Report conversation
          </button>
        )}
        {reported && <span className="text-fg-subtle">Reported to moderators</span>}
      </div>

      {reporting && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const reason = new FormData(e.currentTarget).get("reason");
            setError(null);
            start(async () => {
              const res = await reportConversation(conversationId, { reason });
              if (res.ok) {
                setReported(true);
                setReporting(false);
                router.refresh();
              } else setError(res.error);
            });
          }}
          className="space-y-2 rounded-md border border-border bg-surface p-2.5"
        >
          <textarea
            name="reason"
            required
            rows={3}
            maxLength={500}
            placeholder="What's wrong with this conversation?"
            className="w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
          <div className="flex gap-2">
            <button
              disabled={pending}
              className="rounded-md bg-brand px-2.5 py-1 font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => setReporting(false)}
              className="rounded-md px-2.5 py-1 text-fg-muted hover:bg-surface-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-danger-fg">{error}</p>}
    </div>
  );
}
