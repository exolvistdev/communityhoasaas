"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { peso } from "@/lib/format";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";
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

  const editing = editingId ? vendors.find((v) => v.id === editingId) : undefined;

  const columns: ResponsiveColumn<Vendor>[] = [
    {
      key: "name",
      header: "Vendor",
      card: "title",
      className: "font-medium",
      cell: (v) => (
        <>
          <Link href={`/vendors/${v.id}`} className="hover:underline">
            {v.name}
          </Link>
          {v.archived && (
            <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs text-fg-muted">
              Archived
            </span>
          )}
        </>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      className: "text-fg-muted",
      cell: (v) => v.contactName || v.email || v.phone || "—",
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      className: "text-fg-muted",
      cell: (v) =>
        v.owed > 0
          ? `${peso(v.owed)} · ${v.openBills} bill${v.openBills === 1 ? "" : "s"}`
          : "—",
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      card: "action",
      cell: (v) => (
        <>
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
            onClick={() => act(() => setVendorArchived(v.id, !v.archived))}
            disabled={pending}
            className="ml-3 text-xs text-fg-muted underline hover:text-fg disabled:opacity-50"
          >
            {v.archived ? "Restore" : "Archive"}
          </button>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex sm:justify-end">
        {!adding && !editing && (
          <button
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className="w-full rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 sm:w-auto"
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

      {editing && (
        <VendorForm
          initial={{
            name: editing.name,
            contactName: editing.contactName ?? "",
            email: editing.email ?? "",
            phone: editing.phone ?? "",
            notes: editing.notes ?? "",
          }}
          pending={pending}
          onCancel={() => setEditingId(null)}
          onSave={(d) => act(() => updateVendor(editing.id, d))}
        />
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <ResponsiveTable
        columns={columns}
        rows={editingId ? vendors.filter((v) => v.id !== editingId) : vendors}
        rowKey={(v) => v.id}
        rowClassName={(v) => (v.archived ? "text-fg-subtle" : undefined)}
        empty={
          !adding && !editing ? (
            <div className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-fg-subtle">
              No vendors yet.
            </div>
          ) : undefined
        }
      />
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
