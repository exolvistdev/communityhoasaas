"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmPayment, rejectPayment } from "./actions";

export function ReconciliationActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setRejecting(false);
        router.refresh();
      } else setError(res.error ?? "Something went wrong");
    });
  }

  if (rejecting) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => rejectPayment(id, { reason: fd.get("reason") }));
        }}
        className="flex items-center gap-2"
      >
        <input
          name="reason"
          placeholder="Reason (optional)"
          className="rounded-md border border-border px-2 py-1 text-xs outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Confirm reject
        </button>
        <button
          type="button"
          onClick={() => setRejecting(false)}
          className="text-xs text-fg-muted hover:text-fg"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-danger-fg">{error}</span>}
      <button
        onClick={() => run(() => confirmPayment(id))}
        disabled={pending}
        className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "…" : "Confirm"}
      </button>
      <button
        onClick={() => setRejecting(true)}
        disabled={pending}
        className="text-xs text-danger-fg underline hover:text-danger-fg"
      >
        Reject
      </button>
    </div>
  );
}
