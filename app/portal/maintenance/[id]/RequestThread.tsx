"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComment, cancelRequest } from "../actions";

export function RequestThread({
  requestId,
  canComment,
  canCancel,
}: {
  requestId: string;
  canComment: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = new FormData(form).get("body");
    setError(null);
    start(async () => {
      const res = await addComment(requestId, { body });
      if (res.ok) {
        form.reset();
        router.refresh();
      } else setError(res.error);
    });
  }

  function onCancel() {
    if (!window.confirm("Withdraw this request?")) return;
    setError(null);
    start(async () => {
      const res = await cancelRequest(requestId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {canComment && (
        <form onSubmit={onComment} className="space-y-2">
          <textarea
            name="body"
            rows={2}
            required
            placeholder="Add a comment or more detail…"
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </form>
      )}

      {canCancel && (
        <button
          onClick={onCancel}
          disabled={pending}
          className="text-sm text-danger-fg hover:underline disabled:opacity-50"
        >
          Withdraw this request
        </button>
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
