"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { issueRefund } from "./actions";

const METHODS = [
  ["CASH", "Cash"],
  ["BANK_TRANSFER", "Bank transfer"],
  ["CHECK", "Check"],
  ["GCASH", "GCash"],
  ["MAYA", "Maya"],
] as const;

export function RefundCreditButton({
  propertyId,
  creditBalance,
}: {
  propertyId: string;
  creditBalance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await issueRefund(propertyId, {
        amount: fd.get("amount"),
        method: fd.get("method"),
        reference: fd.get("reference"),
        reason: fd.get("reason"),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-0.5 text-xs text-fg-muted underline underline-offset-2 hover:text-fg"
      >
        Refund credit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 text-left">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg"
          >
            <h2 className="text-base font-semibold text-fg">Refund resident credit</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Credit on file: {peso(creditBalance)}
            </p>

            <label className="mt-4 block text-sm">
              <span className="text-fg">Amount (₱)</span>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                max={creditBalance}
                defaultValue={creditBalance.toFixed(2)}
                required
                className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-fg">Method</span>
              <select
                name="method"
                defaultValue="BANK_TRANSFER"
                className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
              >
                {METHODS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-fg">Reference no. (optional)</span>
              <input
                name="reference"
                className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-fg">Reason</span>
              <input
                name="reason"
                required
                placeholder="e.g. moved out, overpayment returned"
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
                className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Issue refund"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
