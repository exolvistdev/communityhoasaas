"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { recordPayment } from "./actions";

const METHODS = [
  ["CASH", "Cash"],
  ["CHECK", "Check"],
  ["BANK_TRANSFER", "Bank transfer"],
  ["GCASH", "GCash"],
  ["MAYA", "Maya"],
] as const;

export function RecordPaymentButton({
  invoiceId,
  outstanding,
}: {
  invoiceId: string;
  outstanding: number;
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
      const res = await recordPayment({
        invoiceId,
        amount: fd.get("amount"),
        method: fd.get("method"),
        reference: fd.get("reference"),
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
        className="text-sm font-medium text-gray-900 underline underline-offset-2"
      >
        Record payment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
          >
            <h2 className="text-base font-semibold text-gray-900">
              Record payment
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Outstanding balance: {peso(outstanding)}
            </p>

            <label className="mt-4 block text-sm">
              <span className="text-gray-700">Amount (₱)</span>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={outstanding > 0 ? outstanding.toFixed(2) : ""}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
              />
            </label>

            <label className="mt-3 block text-sm">
              <span className="text-gray-700">Method</span>
              <select
                name="method"
                defaultValue="GCASH"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
              >
                {METHODS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-sm">
              <span className="text-gray-700">Reference no. (optional)</span>
              <input
                name="reference"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
              />
            </label>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
