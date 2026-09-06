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
      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="space-y-3">
        {amenities.map((a) =>
          editingId === a.id ? (
            <div
              key={a.id}
              className="rounded-lg border border-border bg-surface-2 p-4"
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
              className={`rounded-lg border border-border bg-surface p-4 ${
                a.archived ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-fg">
                    {a.name}
                    {a.archived && (
                      <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-muted">
                        Archived
                      </span>
                    )}
                  </div>
                  {a.description && (
                    <p className="mt-0.5 text-sm text-fg-muted">
                      {a.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-fg-subtle">
                    {bookingHoursLabel(a)} · {a.fee > 0 ? peso(a.fee, { cents: false }) : "Free"} ·
                    cap {a.capacity} · {a.minNoticeHours}h notice · max {a.maxHours}h ·{" "}
                    {a.requiresApproval ? "needs approval" : "auto-confirms"}
                    {a.upcomingCount > 0
                      ? ` · ${a.upcomingCount} upcoming`
                      : ""}
                  </p>
                  {a.feeNote && (
                    <p className="mt-0.5 text-xs text-fg-subtle">{a.feeNote}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  <button
                    onClick={() => {
                      setEditingId(a.id);
                      setAdding(false);
                    }}
                    className="text-fg-muted underline hover:text-fg"
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
                    className="text-fg-muted underline hover:text-fg"
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
        <div className="rounded-lg border border-border bg-surface-2 p-4">
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
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 sm:w-auto"
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
      <span className="text-fg-muted">{label}</span>
      <input
        type="number"
        min={min}
        value={f[k] as number}
        onChange={(e) => set(k, Number(e.target.value) as never)}
        className="mt-1 block w-24 rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
      />
    </label>
  );

  return (
    <div className="space-y-3">
      <label className="block text-xs">
        <span className="text-fg-muted">Name</span>
        <input
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
          className="mt-1 block w-full max-w-sm rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
        />
      </label>
      <label className="block text-xs">
        <span className="text-fg-muted">Description</span>
        <textarea
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          className="mt-1 block w-full max-w-lg rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
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
        <span className="text-fg-muted">Fee note (informational)</span>
        <input
          value={f.feeNote}
          onChange={(e) => set("feeNote", e.target.value)}
          placeholder="+ ₱3,000 refundable deposit, settled at the office"
          className="mt-1 block w-full max-w-lg rounded-md border border-border px-2 py-1 outline-none focus:border-brand"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-fg">
        <input
          type="checkbox"
          checked={f.fee > 0 ? true : f.requiresApproval}
          disabled={f.fee > 0}
          onChange={(e) => set("requiresApproval", e.target.checked)}
        />
        Bookings need staff approval
        {f.fee > 0 && (
          <span className="text-fg-subtle">(fee amenities always need approval)</span>
        )}
      </label>

      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(f)}
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
    </div>
  );
}
