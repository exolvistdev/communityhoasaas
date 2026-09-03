"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MaintenanceStatus } from "@prisma/client";
import { canTransitionMaintenance } from "@/lib/maintenance";
import { setStatus, assignRequest, linkBill, addStaffComment } from "../actions";

const ALL: MaintenanceStatus[] = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];
const LABEL: Record<MaintenanceStatus, string> = {
  OPEN: "Reopen",
  ACKNOWLEDGED: "Acknowledge",
  IN_PROGRESS: "Start work",
  RESOLVED: "Mark resolved",
  CLOSED: "Close",
  CANCELLED: "Cancel",
};

export function MaintenanceTriage({
  requestId,
  status,
  currentAssigneeId,
  currentVendorId,
  currentBillId,
  staff,
  vendors,
  bills,
}: {
  requestId: string;
  status: MaintenanceStatus;
  currentAssigneeId: string;
  currentVendorId: string;
  currentBillId: string;
  staff: { id: string; fullName: string }[];
  vendors: { id: string; name: string }[];
  bills: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [assignee, setAssignee] = useState(currentAssigneeId);
  const [vendor, setVendor] = useState(currentVendorId);
  const [bill, setBill] = useState(currentBillId);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong");
    });
  }

  function move(next: MaintenanceStatus) {
    const note =
      next === "RESOLVED" || next === "CANCELLED"
        ? window.prompt(
            next === "RESOLVED"
              ? "Add a note for the resident (optional):"
              : "Reason (optional):"
          ) ?? ""
        : "";
    run(() => setStatus(requestId, { status: next, note }));
  }

  function onComment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    run(async () => {
      const res = await addStaffComment(requestId, {
        body: fd.get("body"),
        staffOnly: fd.get("staffOnly"),
      });
      if (res.ok) form.reset();
      return res;
    });
  }

  const targets = ALL.filter((s) => canTransitionMaintenance(status, s, "staff"));

  return (
    <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Triage</h2>

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
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-fg-muted">Assigned to</span>
          <select
            value={assignee}
            onChange={(e) => {
              setAssignee(e.target.value);
              run(() =>
                assignRequest(requestId, { assignedToId: e.target.value, vendorId: vendor })
              );
            }}
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-fg-muted">Vendor</span>
          <select
            value={vendor}
            onChange={(e) => {
              setVendor(e.target.value);
              run(() =>
                assignRequest(requestId, { assignedToId: assignee, vendorId: e.target.value })
              );
            }}
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          >
            <option value="">None</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-fg-muted">Linked bill</span>
          <select
            value={bill}
            onChange={(e) => {
              setBill(e.target.value);
              run(() => linkBill(requestId, e.target.value || null));
            }}
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          >
            <option value="">None</option>
            {bills.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form onSubmit={onComment} className="space-y-2 border-t border-border pt-3">
        <textarea
          name="body"
          rows={2}
          required
          placeholder="Add a comment…"
          className="w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-fg-muted">
            <input type="checkbox" name="staffOnly" /> Internal note (not shown to
            the resident)
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </section>
  );
}
