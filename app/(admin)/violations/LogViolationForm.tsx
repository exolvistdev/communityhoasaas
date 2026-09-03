"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  VIOLATION_CATEGORIES,
  VIOLATION_PHOTO_ACCEPT,
  VIOLATION_PHOTO_MAX,
} from "@/lib/violation";
import { logViolation } from "./actions";

export function LogViolationForm({
  properties,
}: {
  properties: { id: string; unitNumber: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await logViolation(fd);
      if (res.ok) {
        setOpen(false);
        formRef.current?.reset();
        router.push(`/violations/${res.id}`);
      } else setError(res.error);
    });
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
      >
        Log a violation
      </button>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-3 rounded-lg bg-surface p-5 shadow-lg"
      >
        <h2 className="text-base font-semibold text-fg">Log a violation</h2>

        <label className="block text-sm">
          <span className="text-fg">Unit</span>
          <select
            name="propertyId"
            required
            defaultValue=""
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          >
            <option value="" disabled>
              Select a unit…
            </option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.unitNumber}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-fg">Category</span>
            <select
              name="category"
              required
              defaultValue=""
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            >
              <option value="" disabled>
                Select…
              </option>
              {VIOLATION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-fg">Date occurred</span>
            <input
              type="date"
              name="occurredAt"
              required
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-fg">What happened?</span>
          <textarea
            name="description"
            rows={3}
            required
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>

        <label className="block text-sm">
          <span className="text-fg">Resolve by (optional)</span>
          <input
            type="date"
            name="cureByDate"
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>

        <label className="block text-sm">
          <span className="text-fg">Photos (optional, up to {VIOLATION_PHOTO_MAX})</span>
          <input
            type="file"
            name="photos"
            accept={VIOLATION_PHOTO_ACCEPT}
            multiple
            className="mt-1 block w-full text-xs text-fg-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1 file:text-xs"
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
            {pending ? "Saving…" : "Log violation"}
          </button>
        </div>
      </form>
    </div>
  );
}
