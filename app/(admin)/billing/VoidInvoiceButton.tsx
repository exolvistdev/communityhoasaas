"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidInvoice } from "./actions";

export function VoidInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-danger-fg underline hover:text-danger-fg"
      >
        Void
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          start(async () => {
            const res = await voidInvoice(invoiceId, { reason: fd.get("reason") });
            if (res.ok) {
              setOpen(false);
              router.refresh();
            } else setError(res.error);
          });
        }}
        className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold text-fg">Void invoice</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Posts a reversing ledger entry and removes this invoice from the
          property&apos;s balance. Can&apos;t be undone.
        </p>
        <label className="mt-3 block text-sm">
          <span className="text-fg">Reason</span>
          <input
            name="reason"
            required
            autoFocus
            placeholder="e.g. wrong amount, unit sold"
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>
        {error && <p className="mt-2 text-sm text-danger-fg">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
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
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Voiding…" : "Void invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
