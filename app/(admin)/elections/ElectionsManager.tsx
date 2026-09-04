"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createElection, updateElection } from "./actions";

type Initial = {
  id: string;
  title: string;
  description: string;
  seats: number;
  opensAt: string; // datetime-local value
  closesAt: string;
  quorumPct: number;
  termMonths: number;
  meetingId: string | null;
};

export function ElectionsManager({
  initial,
  meetings,
}: {
  initial?: Initial;
  meetings: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: fd.get("title"),
      description: fd.get("description"),
      seats: fd.get("seats"),
      opensAt: fd.get("opensAt"),
      closesAt: fd.get("closesAt"),
      quorumPct: fd.get("quorumPct"),
      termMonths: fd.get("termMonths"),
      meetingId: fd.get("meetingId"),
    };
    setError(null);
    start(async () => {
      const res = initial
        ? await updateElection(initial.id, payload)
        : await createElection(payload);
      if (res.ok) {
        setOpen(false);
        if (!initial && "id" in res) router.push(`/elections/${res.id}`);
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
        {initial ? "Edit" : "New election"}
      </button>
    );

  const field =
    "mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-3 rounded-lg bg-surface p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold text-fg">
          {initial ? "Edit election" : "New board election"}
        </h2>

        <label className="block text-sm">
          <span className="text-fg">Title</span>
          <input
            name="title"
            required
            defaultValue={initial?.title}
            placeholder="e.g. 2027 Board of Trustees Election"
            className={field}
          />
        </label>

        <label className="block text-sm">
          <span className="text-fg">Description</span>
          <textarea
            name="description"
            rows={3}
            required
            defaultValue={initial?.description}
            placeholder="How the election runs, and what members are electing."
            className={`${field} text-sm`}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-fg">Open seats</span>
            <input
              name="seats"
              type="number"
              min={1}
              max={25}
              required
              defaultValue={initial?.seats ?? 5}
              className={field}
            />
            <span className="mt-0.5 block text-xs text-fg-subtle">
              An odd number is typical.
            </span>
          </label>
          <label className="block text-sm">
            <span className="text-fg">Term (months)</span>
            <input
              name="termMonths"
              type="number"
              min={1}
              max={60}
              required
              defaultValue={initial?.termMonths ?? 12}
              className={field}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-fg">Opens</span>
            <input
              name="opensAt"
              type="datetime-local"
              required
              defaultValue={initial?.opensAt}
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="text-fg">Closes</span>
            <input
              name="closesAt"
              type="datetime-local"
              required
              defaultValue={initial?.closesAt}
              className={field}
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-fg">Quorum (% of units in good standing)</span>
          <input
            name="quorumPct"
            type="number"
            min={0}
            max={100}
            required
            defaultValue={initial?.quorumPct ?? 40}
            className={field}
          />
        </label>

        <label className="block text-sm">
          <span className="text-fg">Held at meeting (optional)</span>
          <select
            name="meetingId"
            defaultValue={initial?.meetingId ?? ""}
            className={field}
          >
            <option value="">— none —</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
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
            {pending ? "Saving…" : initial ? "Save changes" : "Create draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
