"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVote, updateVote } from "./actions";

type Initial = {
  id: string;
  title: string;
  description: string;
  opensAt: string; // datetime-local value
  closesAt: string;
  quorumPct: number;
  threshold: "MAJORITY" | "TWO_THIRDS";
  meetingId: string | null;
};

export function VotesManager({
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
      opensAt: fd.get("opensAt"),
      closesAt: fd.get("closesAt"),
      quorumPct: fd.get("quorumPct"),
      threshold: fd.get("threshold"),
      meetingId: fd.get("meetingId"),
    };
    setError(null);
    start(async () => {
      const res = initial
        ? await updateVote(initial.id, payload)
        : await createVote(payload);
      if (res.ok) {
        setOpen(false);
        if (!initial && "id" in res) router.push(`/votes/${res.id}`);
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
        {initial ? "Edit" : "New vote"}
      </button>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-3 rounded-lg bg-surface p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold text-fg">
          {initial ? "Edit vote" : "New vote"}
        </h2>

        <label className="block text-sm">
          <span className="text-fg">Motion title</span>
          <input
            name="title"
            required
            defaultValue={initial?.title}
            placeholder="e.g. Approve the 2027 operating budget"
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>

        <label className="block text-sm">
          <span className="text-fg">Description</span>
          <textarea
            name="description"
            rows={4}
            required
            defaultValue={initial?.description}
            placeholder="What members are voting on, and the effect of a yes / no."
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-fg">Opens</span>
            <input
              name="opensAt"
              type="datetime-local"
              required
              defaultValue={initial?.opensAt}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="text-fg">Closes</span>
            <input
              name="closesAt"
              type="datetime-local"
              required
              defaultValue={initial?.closesAt}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-fg">Quorum (% of units)</span>
            <input
              name="quorumPct"
              type="number"
              min={0}
              max={100}
              required
              defaultValue={initial?.quorumPct ?? 50}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="text-fg">Passes with</span>
            <select
              name="threshold"
              defaultValue={initial?.threshold ?? "MAJORITY"}
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            >
              <option value="MAJORITY">Simple majority</option>
              <option value="TWO_THIRDS">Two-thirds</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-fg">Raised at meeting (optional)</span>
          <select
            name="meetingId"
            defaultValue={initial?.meetingId ?? ""}
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
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
