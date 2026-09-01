"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeListing, restoreListing, dismissReports } from "./actions";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong");
    });
  };
  return { pending, error, run };
}

export function RemoveListingButton({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  const [open, setOpen] = useState(false);

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Take down
      </button>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const reason = new FormData(e.currentTarget).get("reason");
        run(() => removeListing(id, reason));
      }}
      className="space-y-2 rounded-md border border-gray-200 bg-white p-3"
    >
      <label className="block text-sm text-gray-700">
        Reason (the seller sees this)
        <input
          name="reason"
          required
          maxLength={500}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-gray-900"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={pending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Removing…" : "Confirm take-down"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function RestoreListingButton({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  return (
    <span>
      <button
        onClick={() => run(() => restoreListing(id))}
        disabled={pending}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {pending ? "…" : "Restore"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </span>
  );
}

export function DismissReportsButton({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  return (
    <span>
      <button
        onClick={() => run(() => dismissReports(id))}
        disabled={pending}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {pending ? "…" : "Dismiss reports"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </span>
  );
}
