"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { bookingHoursLabel } from "@/lib/amenity";
import { createAmenity, updateAmenity, setAmenityArchived } from "./actions";

export type AmenityRow = {
  id: string;
  name: string;
  description: string | null;
  fee: number;
  feeNote: string | null;
  capacity: number;
  openHour: number;
  closeHour: number;
  minNoticeHours: number;
  maxHours: number;
  cancellationCutoffHours: number;
  requiresApproval: boolean;
  archived: boolean;
  upcomingCount: number;
};

export function AmenitiesManager({ amenities }: { amenities: AmenityRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setAdding(false);
        setEditingId(null);
        router.refresh();
      } else setError(res.error ?? "Something went wrong");
    });
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {amenities.map((a) =>
          editingId === a.id ? (
            <div
              key={a.id}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <AmenityForm
                initial={a}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(data) => act(() => updateAmenity(a.id, data))}
              />
            </div>
          ) : (
            <div
              key={a.id}
              className={`rounded-lg border border-gray-200 bg-white p-4 ${
                a.archived ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {a.name}
                    {a.archived && (
                      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Archived
                      </span>
                    )}
                  </div>
                  {a.description && (
                    <p className="mt-0.5 text-sm text-gray-500">
                      {a.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {bookingHoursLabel(a)} · {a.fee > 0 ? peso(a.fee, { cents: false }) : "Free"} ·
                    cap {a.capacity} · {a.minNoticeHours}h notice · max {a.maxHours}h ·{" "}
                    {a.requiresApproval ? "needs approval" : "auto-confirms"}
                    {a.upcomingCount > 0
                      ? ` · ${a.upcomingCount} upcoming`
                      : ""}
                  </p>
                  {a.feeNote && (
                    <p className="mt-0.5 text-xs text-gray-400">{a.feeNote}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  <button
                    onClick={() => {
                      setEditingId(a.id);
                      setAdding(false);
                    }}
                    className="text-gray-500 underline hover:text-gray-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (
                        !a.archived &&
                        a.upcomingCount > 0 &&
                        !confirm(
                          `${a.name} has ${a.upcomingCount} upcoming booking${
                            a.upcomingCount === 1 ? "" : "s"
                          }. Archiving hides it from residents but keeps those bookings. Continue?`
                        )
                      )
                        return;
                      act(() => setAmenityArchived(a.id, !a.archived));
                    }}
                    className="text-gray-500 underline hover:text-gray-900"
                  >
                    {a.archived ? "Restore" : "Archive"}
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {adding ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <AmenityForm
            pending={pending}
            onCancel={() => setAdding(false)}
            onSubmit={(data) => act(() => createAmenity(data))}
          />
        </div>
      ) : (
        <button
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Add amenity
        </button>
      )}
    </div>
  );
}

type FormData = {
  name: string;
  description: string;
  fee: number;
  feeNote: string;
  capacity: number;
  openHour: number;
  closeHour: number;
  minNoticeHours: number;
  maxHours: number;
  cancellationCutoffHours: number;
  requiresApproval: boolean;
};

function AmenityForm({
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  initial?: AmenityRow;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: FormData) => void;
}) {
  const [f, setF] = useState<FormData>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    fee: initial?.fee ?? 0,
    feeNote: initial?.feeNote ?? "",
    capacity: initial?.capacity ?? 1,
    openHour: initial?.openHour ?? 8,
    closeHour: initial?.closeHour ?? 22,
    minNoticeHours: initial?.minNoticeHours ?? 24,
    maxHours: initial?.maxHours ?? 4,
    cancellationCutoffHours: initial?.cancellationCutoffHours ?? 48,
    requiresApproval: initial?.requiresApproval ?? true,
  });
  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setF((cur) => ({ ...cur, [k]: v }));

  const num = (label: string, k: keyof FormData, min = 0) => (
    <label className="text-xs">
      <span className="text-gray-600">{label}</span>
      <input
        type="number"
        min={min}
        value={f[k] as number}
        onChange={(e) => set(k, Number(e.target.value) as never)}
        className="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
      />
    </label>
  );

  return (
    <div className="space-y-3">
      <label className="block text-xs">
        <span className="text-gray-600">Name</span>
        <input
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
          className="mt-1 block w-full max-w-sm rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
        />
      </label>
      <label className="block text-xs">
        <span className="text-gray-600">Description</span>
        <textarea
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          className="mt-1 block w-full max-w-lg rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        {num("Fee (₱)", "fee")}
        {num("Capacity", "capacity", 1)}
        {num("Open hour", "openHour")}
        {num("Close hour", "closeHour", 1)}
        {num("Min notice (h)", "minNoticeHours")}
        {num("Max length (h)", "maxHours", 1)}
        {num("Cancel cutoff (h)", "cancellationCutoffHours")}
      </div>

      <label className="block text-xs">
        <span className="text-gray-600">Fee note (informational)</span>
        <input
          value={f.feeNote}
          onChange={(e) => set("feeNote", e.target.value)}
          placeholder="+ ₱3,000 refundable deposit, settled at the office"
          className="mt-1 block w-full max-w-lg rounded-md border border-gray-300 px-2 py-1 outline-none focus:border-gray-900"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={f.fee > 0 ? true : f.requiresApproval}
          disabled={f.fee > 0}
          onChange={(e) => set("requiresApproval", e.target.checked)}
        />
        Bookings need staff approval
        {f.fee > 0 && (
          <span className="text-gray-400">(fee amenities always need approval)</span>
        )}
      </label>

      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(f)}
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
    </div>
  );
}
