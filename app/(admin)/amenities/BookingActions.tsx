"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideBooking, cancelBookingAsStaff } from "./actions";

export function BookingDecision({
  id,
  rejectOnly = false,
}: {
  id: string;
  rejectOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong");
    });
  };

  if (rejecting)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const note = new FormData(e.currentTarget).get("note");
          run(() => decideBooking(id, "REJECTED", note));
        }}
        className="space-y-2"
      >
        <input
          name="note"
          placeholder="Reason (optional)"
          maxLength={500}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-gray-900"
        />
        <div className="flex gap-2">
          <button
            disabled={pending}
            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Confirm reject
          </button>
          <button
            type="button"
            onClick={() => setRejecting(false)}
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    );

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {!rejectOnly && (
          <button
            onClick={() => run(() => decideBooking(id, "CONFIRMED"))}
            disabled={pending}
            className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Approve
          </button>
        )}
        <button
          onClick={() => setRejecting(true)}
          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Reject
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function StaffCancelButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-red-500 underline hover:text-red-700"
      >
        Cancel
      </button>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const note = new FormData(e.currentTarget).get("note");
        setError(null);
        start(async () => {
          const res = await cancelBookingAsStaff(id, note);
          if (res.ok) router.refresh();
          else setError(res.error ?? "Something went wrong");
        });
      }}
      className="space-y-1"
    >
      <input
        name="note"
        placeholder="Reason (optional)"
        maxLength={500}
        className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-gray-900"
      />
      <div className="flex gap-2">
        <button
          disabled={pending}
          className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          Keep
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
