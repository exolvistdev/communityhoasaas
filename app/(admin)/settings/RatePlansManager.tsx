"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
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

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 text-right font-medium">Monthly rate</th>
              <th className="px-4 py-2.5 font-medium">Properties</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && !adding && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No rate plans yet.
                </td>
              </tr>
            )}

            {plans.map((p) =>
              editingId === p.id ? (
                <tr key={p.id} className="border-t border-gray-100 bg-gray-50">
                  <td colSpan={4} className="px-4 py-3">
                    <PlanForm
                      initial={p}
                      pending={pending}
                      onCancel={() => setEditingId(null)}
                      onSubmit={(data) =>
                        act(() => updateRatePlan(p.id, data), "Plan updated")
                      }
                    />
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {p.name}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {peso(p.monthlyRate)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {p.propertyCount}
                    {p.staleCount > 0 && (
                      <span className="ml-2 text-xs text-amber-700">
                        {p.staleCount} on an older rate ·{" "}
                        <button
                          onClick={() =>
                            act(
                              () => reapplyRatePlan(p.id),
                              "Rate re-applied to matching properties"
                            )
                          }
                          className="underline hover:text-amber-900"
                        >
                          re-apply
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setAdding(false);
                      }}
                      className="text-xs text-gray-500 underline hover:text-gray-900"
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
                        act(
                          () => deleteRatePlan(p.id),
                          `Deleted "${p.name}"`
                        );
                      }}
                      className="ml-3 text-xs text-red-500 underline hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}

            {adding && (
              <tr className="border-t border-gray-100 bg-gray-50">
                <td colSpan={4} className="px-4 py-3">
                  <PlanForm
                    pending={pending}
                    onCancel={() => setAdding(false)}
                    onSubmit={(data) =>
                      act(() => createRatePlan(data), "Plan created")
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!adding && (
        <button
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
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
        <span className="text-gray-600">Plan name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
        />
      </label>
      <label className="text-xs">
        <span className="text-gray-600">Monthly rate (₱)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="mt-1 block w-32 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
        />
      </label>
      <button
        onClick={() => onSubmit({ name, monthlyRate: rate })}
        disabled={pending}
        className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-gray-500 hover:text-gray-900"
      >
        Cancel
      </button>
    </div>
  );
}
