"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scheduleMeeting, updateMeeting } from "./actions";

type Initial = {
  id: string;
  title: string;
  scheduledAt: string; // datetime-local value
  location: string;
  agenda: string;
};

export function MeetingsManager({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: fd.get("title"),
      scheduledAt: fd.get("scheduledAt"),
      location: fd.get("location"),
      agenda: fd.get("agenda"),
    };
    setError(null);
    start(async () => {
      const res = initial
        ? await updateMeeting(initial.id, payload)
        : await scheduleMeeting(payload);
      if (res.ok) {
        setOpen(false);
        if (!initial && "id" in res) router.push(`/meetings/${res.id}`);
        else router.refresh();
      } else setError(res.error);
    });
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className={
          initial
            ? "rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
            : "rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
        }
      >
        {initial ? "Edit" : "Schedule a meeting"}
      </button>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-3 rounded-lg bg-surface p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold text-fg">
          {initial ? "Edit meeting" : "Schedule a board meeting"}
        </h2>

        <label className="block text-sm">
          <span className="text-fg">Title</span>
          <input
            name="title"
            required
            defaultValue={initial?.title}
            placeholder="e.g. Q4 board meeting"
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-fg">Date &amp; time</span>
            <input
              name="scheduledAt"
              type="datetime-local"
              required
              defaultValue={initial?.scheduledAt}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="text-fg">Location</span>
            <input
              name="location"
              defaultValue={initial?.location}
              placeholder="Clubhouse / Zoom link"
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-fg">Agenda</span>
          <textarea
            name="agenda"
            rows={5}
            required
            defaultValue={initial?.agenda}
            placeholder={"1. Approval of previous minutes\n2. Treasurer's report\n3. …"}
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
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
            {pending
              ? "Saving…"
              : initial
              ? "Save changes"
              : "Schedule & notify residents"}
          </button>
        </div>
      </form>
    </div>
  );
}
