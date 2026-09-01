"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { submitPayment } from "../actions";

type Payment = {
  gcashNumber: string | null;
  gcashName: string | null;
  mayaNumber: string | null;
  mayaName: string | null;
  paymentInstructions: string | null;
};

type Method = "GCASH" | "MAYA" | "OFFLINE";

export function PayNowClient({
  balance,
  payment,
}: {
  balance: number;
  payment: Payment;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("GCASH");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-5 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-xl text-green-700">
          ✓
        </div>
        <p className="text-sm text-green-800">
          Payment submitted. Your HOA will confirm it and it will show on your
          account once verified.
        </p>
        <button
          onClick={() => router.push("/portal")}
          className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Back to portal
        </button>
      </div>
    );
  }

  const online = method === "GCASH" || method === "MAYA";
  const acctNumber = method === "GCASH" ? payment.gcashNumber : payment.mayaNumber;
  const acctName = method === "GCASH" ? payment.gcashName : payment.mayaName;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!online) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await submitPayment({
        amount: fd.get("amount"),
        method,
        reference: fd.get("reference"),
        note: fd.get("note"),
      });
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm text-gray-500">Amount due</div>
        <div className="text-2xl font-semibold text-gray-900">
          {peso(balance)}
        </div>
      </div>

      {/* method picker */}
      <div className="grid grid-cols-4 gap-2 text-sm">
        {(
          [
            ["GCASH", "GCash"],
            ["MAYA", "Maya"],
            ["OFFLINE", "Cash / Bank"],
          ] as [Method, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`rounded-md border px-2 py-1.5 ${
              method === m
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-600"
            } ${m === "OFFLINE" ? "col-span-2" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {online ? (
        !acctNumber ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Your HOA hasn&apos;t set up {method === "GCASH" ? "GCash" : "Maya"}{" "}
            details yet. Try Cash / Bank, or contact the office.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
              <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-400">
                {method === "GCASH" ? "GCash" : "Maya"} QR
              </div>
              <div className="mt-3 text-sm font-medium text-gray-900">
                {acctName}
              </div>
              <div className="text-sm text-gray-600">{acctNumber}</div>
              <p className="mt-2 text-xs text-gray-400">
                Send the payment in your {method === "GCASH" ? "GCash" : "Maya"}{" "}
                app, then enter the details below.
              </p>
            </div>

            <label className="block text-sm">
              <span className="text-gray-700">Amount paid (₱)</span>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={balance.toFixed(2)}
                required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Reference number</span>
              <input
                name="reference"
                required
                placeholder="from your payment confirmation"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Note (optional)</span>
              <input
                name="note"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {pending ? "Submitting…" : "I've paid — submit for confirmation"}
            </button>
          </form>
        )
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <p className="whitespace-pre-wrap text-gray-700">
            {payment.paymentInstructions ||
              "Please visit the HOA office to pay by cash, check, or bank transfer."}
          </p>
          <p className="mt-3 text-xs text-gray-400">
            The office will record your payment once received — no need to submit
            anything here.
          </p>
        </div>
      )}
    </div>
  );
}
