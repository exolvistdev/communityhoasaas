"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { BILL_PAYMENT_METHODS } from "@/lib/bill";
import { payBill, voidBill } from "../actions";

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank transfer",
  GCASH: "GCash",
  MAYA: "Maya",
};

export function BillActions({
  billId,
  remaining,
  canVoid,
}: {
  billId: string;
  remaining: number;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showPay, setShowPay] = useState(false);

  function onPay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await payBill(billId, {
        amount: fd.get("amount"),
        method: fd.get("method"),
        reference: fd.get("reference"),
        paidAt: fd.get("paidAt"),
      });
      if (res.ok) {
        setShowPay(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  function onVoid() {
    const reason = window.prompt("Reason for voiding this bill:");
    if (!reason) return;
    setError(null);
    start(async () => {
      const res = await voidBill(billId, { reason });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Actions</h2>

      <div className="flex flex-wrap gap-2">
        {remaining > 0.005 && (
          <button
            onClick={() => setShowPay((v) => !v)}
            disabled={pending}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            Record payment
          </button>
        )}
        {canVoid && (
          <button
            onClick={onVoid}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-sm text-danger-fg hover:bg-danger-subtle disabled:opacity-50"
          >
            Void bill
          </button>
        )}
      </div>

      {showPay && (
        <form
          onSubmit={onPay}
          className="grid gap-3 rounded-md bg-surface-2 p-3 sm:grid-cols-2"
        >
          <label className="text-sm">
            <span className="text-fg-muted">Amount (₱)</span>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              max={remaining}
              defaultValue={remaining.toFixed(2)}
              required
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="text-sm">
            <span className="text-fg-muted">Method</span>
            <select
              name="method"
              defaultValue="BANK_TRANSFER"
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            >
              {BILL_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-fg-muted">Date paid</span>
            <input
              name="paidAt"
              type="date"
              defaultValue={today}
              required
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="text-sm">
            <span className="text-fg-muted">Reference (optional)</span>
            <input
              name="reference"
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Saving…" : `Pay ${peso(remaining)}`}
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </section>
  );
}
