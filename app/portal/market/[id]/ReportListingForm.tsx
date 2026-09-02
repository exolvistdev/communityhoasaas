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
      <p className="text-center text-xs text-fg-subtle">
        You reported this listing. A moderator will review it.
      </p>
    );

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mx-auto block text-xs text-fg-subtle underline hover:text-fg-muted"
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
      className="space-y-2 rounded-lg border border-border bg-surface p-3"
    >
      <label className="block text-sm text-fg">
        What&apos;s wrong with this listing?
        <textarea
          name="reason"
          required
          rows={3}
          maxLength={500}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </label>
      {error && <p className="text-sm text-danger-fg">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Submit report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
