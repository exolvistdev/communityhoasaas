"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordBill } from "./actions";

export function AddBillForm({
  vendors,
  expenseAccounts,
}: {
  vendors: { id: string; name: string }[];
  expenseAccounts: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const disabled = vendors.length === 0;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await recordBill({
        vendorId: fd.get("vendorId"),
        description: fd.get("description"),
        billNumber: fd.get("billNumber"),
        amount: fd.get("amount"),
        billDate: fd.get("billDate"),
        dueDate: fd.get("dueDate"),
        expenseAccountCode: fd.get("expenseAccountCode"),
      });
      if (res.ok) {
        setOpen(false);
        router.push(`/bills/${res.id}`);
      } else setError(res.error);
    });
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? "Add a vendor first" : undefined}
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
      >
        Record a bill
      </button>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-3 rounded-lg bg-surface p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold text-fg">Record a bill</h2>

        <label className="block text-sm">
          <span className="text-fg">Vendor</span>
          <select
            name="vendorId"
            required
            defaultValue=""
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          >
            <option value="" disabled>
              Select…
            </option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-fg">Description</span>
          <input
            name="description"
            required
            placeholder="e.g. August landscaping"
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-fg">Amount (₱)</span>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="text-fg">Bill no. (optional)</span>
            <input
              name="billNumber"
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="text-fg">Bill date</span>
            <input
              name="billDate"
              type="date"
              required
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="text-fg">Due date</span>
            <input
              name="dueDate"
              type="date"
              required
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-fg">Expense account</span>
          <select
            name="expenseAccountCode"
            required
            defaultValue=""
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          >
            <option value="" disabled>
              Select…
            </option>
            {expenseAccounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-danger-fg">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
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
            {pending ? "Saving…" : "Record bill"}
          </button>
        </div>
      </form>
    </div>
  );
}
