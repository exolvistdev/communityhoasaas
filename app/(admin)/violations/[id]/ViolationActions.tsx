"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ViolationStatus } from "@prisma/client";
import { canTransitionViolation } from "@/lib/violation";
import {
  updateViolationStatus,
  issueFineNotice,
  deleteViolation,
} from "../actions";

const ALL: ViolationStatus[] = ["OPEN", "CURED", "DISMISSED", "APPEALED"];
const LABEL: Record<ViolationStatus, string> = {
  OPEN: "Reopen",
  CURED: "Mark cured",
  DISMISSED: "Dismiss",
  APPEALED: "Mark appealed",
};

export function ViolationActions({
  violationId,
  status,
  hasFines,
}: {
  violationId: string;
  status: ViolationStatus;
  hasFines: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showFine, setShowFine] = useState(false);

  const targets = ALL.filter((s) => canTransitionViolation(status, s));

  function move(next: ViolationStatus) {
    setError(null);
    const note =
      next === "DISMISSED"
        ? window.prompt("Reason for dismissing (optional):") ?? ""
        : "";
    start(async () => {
      const res = await updateViolationStatus(violationId, { status: next, note });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function onFine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await issueFineNotice(violationId, {
        amount: fd.get("amount"),
        dueDate: fd.get("dueDate"),
        note: fd.get("note"),
      });
      if (res.ok) {
        setShowFine(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  function onDelete() {
    if (!window.confirm("Delete this violation? This can't be undone.")) return;
    setError(null);
    start(async () => {
      const res = await deleteViolation(violationId);
      if (res.ok) router.push("/violations");
      else setError(res.error);
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Actions</h2>

      <div className="flex flex-wrap gap-2">
        {targets.map((s) => (
          <button
            key={s}
            onClick={() => move(s)}
            disabled={pending}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            {LABEL[s]}
          </button>
        ))}
        <button
          onClick={() => setShowFine((v) => !v)}
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          Issue fine notice
        </button>
        {!hasFines && (
          <button
            onClick={onDelete}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-sm text-danger-fg hover:bg-danger-subtle disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {showFine && (
        <form
          onSubmit={onFine}
          className="grid gap-3 rounded-md bg-surface-2 p-3 sm:grid-cols-3"
        >
          <label className="text-sm">
            <span className="text-fg-muted">Amount (₱)</span>
            <input
              name="amount"
              type="number"
              min="1"
              step="0.01"
              required
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="text-sm">
            <span className="text-fg-muted">Pay by</span>
            <input
              name="dueDate"
              type="date"
              required
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="text-sm">
            <span className="text-fg-muted">Note (optional)</span>
            <input
              name="note"
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Issuing…" : "Serve fine & bill the resident"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </section>
  );
}
