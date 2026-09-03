"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { appealViolation } from "./actions";

export function AppealButton({ violationId }: { violationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const note = new FormData(e.currentTarget).get("note");
    setError(null);
    start(async () => {
      const res = await appealViolation(violationId, { note });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-brand-accent hover:underline"
      >
        Appeal this violation
      </button>
    );

  return (
    <form onSubmit={onSubmit} className="space-y-2 border-t border-border pt-2">
      <textarea
        name="note"
        rows={3}
        required
        placeholder="Explain why you believe this notice is incorrect…"
        className="w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
      />
      {error && <p className="text-sm text-danger-fg">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit appeal"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
