"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reportListing } from "../actions";

export function ReportListingForm({
  listingId,
  alreadyReported,
}: {
  listingId: string;
  alreadyReported: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(alreadyReported);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done && !open)
    return (
      <p className="text-center text-xs text-gray-400">
        You reported this listing. A moderator will review it.
      </p>
    );

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mx-auto block text-xs text-gray-400 underline hover:text-gray-600"
      >
        Report this listing
      </button>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const reason = new FormData(e.currentTarget).get("reason");
        setError(null);
        start(async () => {
          const res = await reportListing(listingId, { reason });
          if (res.ok) {
            setDone(true);
            setOpen(false);
            router.refresh();
          } else setError(res.error);
        });
      }}
      className="space-y-2 rounded-lg border border-gray-200 bg-white p-3"
    >
      <label className="block text-sm text-gray-700">
        What&apos;s wrong with this listing?
        <textarea
          name="reason"
          required
          rows={3}
          maxLength={500}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Submit report"}
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
