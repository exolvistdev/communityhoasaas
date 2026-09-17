"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";
import {
  createRatePlan,
  deleteRatePlan,
  reapplyRatePlan,
  updateRatePlan,
} from "./actions";

type Plan = {
  id: string;
  name: string;
  monthlyRate: number;
  propertyCount: number;
  staleCount: number;
};

export function RatePlansManager({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setAdding(false);
        setEditingId(null);
        if (ok) setNotice(ok);
        router.refresh();
      } else setError(res.error ?? "Something went wrong");
    });
  }

  const editing = editingId ? plans.find((p) => p.id === editingId) : undefined;

  const columns: ResponsiveColumn<Plan>[] = [
    {
      key: "name",
      header: "Plan",
      card: "title",
      cell: (p) => p.name,
    },
    {
      key: "rate",
      header: "Monthly rate",
      align: "right",
      cell: (p) => peso(p.monthlyRate),
    },
    {
      key: "properties",
      header: "Properties",
      card: "full",
      className: "text-fg-muted",
      cell: (p) => (
        <>
          {p.propertyCount}
          {p.staleCount > 0 && (
            <span className="ml-2 text-xs text-warning-fg">
              {p.staleCount} on an older rate ·{" "}
              <button
                onClick={() =>
                  act(
                    () => reapplyRatePlan(p.id),
                    "Rate re-applied to matching properties"
                  )
                }
                className="underline hover:text-warning-fg"
              >
                re-apply
              </button>
            </span>
          )}
        </>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      className: "whitespace-nowrap",
      card: "action",
      cell: (p) => (
        <>
          <button
            onClick={() => {
              setEditingId(p.id);
              setAdding(false);
            }}
            className="text-xs text-fg-muted underline hover:text-fg"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (
                p.propertyCount > 0 &&
                !confirm(
                  `Delete "${p.name}"? ${p.propertyCount} propert${
                    p.propertyCount === 1 ? "y" : "ies"
                  } will move to a custom rate (keeping the current amount).`
                )
              )
                return;
              act(() => deleteRatePlan(p.id), `Deleted "${p.name}"`);
            }}
            className="ml-3 text-xs text-danger-fg underline hover:text-danger-fg"
          >
            Delete
          </button>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-danger-fg">{error}</p>}
      {notice && <p className="text-sm text-success-fg">{notice}</p>}

      {editing && (
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <PlanForm
            initial={editing}
            pending={pending}
            onCancel={() => setEditingId(null)}
            onSubmit={(data) =>
              act(() => updateRatePlan(editing.id, data), "Plan updated")
            }
          />
        </div>
      )}

      <ResponsiveTable
        columns={columns}
        rows={editingId ? plans.filter((p) => p.id !== editingId) : plans}
        rowKey={(p) => p.id}
        rowClassName={() => "align-top"}
        empty={
          !adding && !editing ? (
            <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-fg-subtle">
              No rate plans yet.
            </div>
          ) : undefined
        }
      />

      {adding && (
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <PlanForm
            pending={pending}
            onCancel={() => setAdding(false)}
            onSubmit={(data) => act(() => createRatePlan(data), "Plan created")}
          />
        </div>
      )}

      {!adding && (
        <button
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 sm:w-auto"
        >
          Add rate plan
        </button>
      )}
    </div>
  );
}

function PlanForm({
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  initial?: { name: string; monthlyRate: number };
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: { name: string; monthlyRate: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [rate, setRate] = useState(
    initial ? String(initial.monthlyRate) : ""
  );

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs">
        <span className="text-fg-muted">Plan name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
        />
      </label>
      <label className="text-xs">
        <span className="text-fg-muted">Monthly rate (₱)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="mt-1 block w-32 rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
        />
      </label>
      <button
        onClick={() => onSubmit({ name, monthlyRate: rate })}
        disabled={pending}
        className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-fg-muted hover:text-fg"
      >
        Cancel
      </button>
    </div>
  );
}
