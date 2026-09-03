"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import { createVendor, updateVendor, setVendorArchived } from "./actions";

type Vendor = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived: boolean;
  owed: number;
  openBills: number;
};

const EMPTY = { name: "", contactName: "", email: "", phone: "", notes: "" };

export function VendorsManager({ vendors }: { vendors: Vendor[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

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
      <div className="flex justify-end">
        {!adding && (
          <button
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
          >
            Add vendor
          </button>
        )}
      </div>

      {adding && (
        <VendorForm
          initial={EMPTY}
          pending={pending}
          onCancel={() => setAdding(false)}
          onSave={(d) => act(() => createVendor(d))}
        />
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-fg-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Vendor</th>
              <th className="px-4 py-2.5 font-medium">Contact</th>
              <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-fg-subtle">
                  No vendors yet.
                </td>
              </tr>
            )}
            {vendors.map((v) =>
              editingId === v.id ? (
                <tr key={v.id} className="border-t border-border">
                  <td colSpan={4} className="px-4 py-3">
                    <VendorForm
                      initial={{
                        name: v.name,
                        contactName: v.contactName ?? "",
                        email: v.email ?? "",
                        phone: v.phone ?? "",
                        notes: v.notes ?? "",
                      }}
                      pending={pending}
                      onCancel={() => setEditingId(null)}
                      onSave={(d) => act(() => updateVendor(v.id, d))}
                    />
                  </td>
                </tr>
              ) : (
                <tr
                  key={v.id}
                  className={`border-t border-border ${
                    v.archived ? "text-fg-subtle" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/vendors/${v.id}`} className="hover:underline">
                      {v.name}
                    </Link>
                    {v.archived && (
                      <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs text-fg-muted">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {v.contactName || v.email || v.phone || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-fg-muted">
                    {v.owed > 0
                      ? `${peso(v.owed)} · ${v.openBills} bill${
                          v.openBills === 1 ? "" : "s"
                        }`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => {
                        setEditingId(v.id);
                        setAdding(false);
                      }}
                      className="text-xs text-fg-muted underline hover:text-fg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        act(() => setVendorArchived(v.id, !v.archived))
                      }
                      disabled={pending}
                      className="ml-3 text-xs text-fg-muted underline hover:text-fg disabled:opacity-50"
                    >
                      {v.archived ? "Restore" : "Archive"}
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorForm({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: typeof EMPTY;
  pending: boolean;
  onSave: (d: typeof EMPTY) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setD((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(d);
      }}
      className="grid gap-2 rounded-md border border-border bg-surface p-3 sm:grid-cols-2"
    >
      <input
        value={d.name}
        onChange={set("name")}
        required
        placeholder="Vendor name"
        className="rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
      />
      <input
        value={d.contactName}
        onChange={set("contactName")}
        placeholder="Contact person"
        className="rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
      />
      <input
        value={d.email}
        onChange={set("email")}
        type="email"
        placeholder="Email"
        className="rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
      />
      <input
        value={d.phone}
        onChange={set("phone")}
        placeholder="Phone"
        className="rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
      />
      <input
        value={d.notes}
        onChange={set("notes")}
        placeholder="Notes (optional)"
        className="rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand sm:col-span-2"
      />
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
