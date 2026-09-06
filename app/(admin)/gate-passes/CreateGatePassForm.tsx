"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGatePass } from "./actions";

type PropertyOption = { id: string; unitNumber: string };

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function CreateGatePassForm({
  properties,
  fixedPropertyId,
  compact = false,
}: {
  properties: PropertyOption[];
  fixedPropertyId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await createGatePass({
        propertyId: fixedPropertyId ?? fd.get("propertyId"),
        visitorName: fd.get("visitorName"),
        validFrom: fd.get("validFrom"),
        validUntil: fd.get("validUntil"),
      });
      if (res.ok) {
        setCreatedCode(res.code);
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  if (!open) {
    const content = (
      <>
        <button
          onClick={() => {
            setOpen(true);
            setCreatedCode(null);
          }}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
        >
          Create gate pass
        </button>
        {createdCode && (
          <span className="text-sm text-success-fg">
            Pass created — code{" "}
            <span className="font-mono font-semibold">{createdCode}</span>
          </span>
        )}
      </>
    );
    // compact = inline next to a section <h2>; otherwise this is the page
    // header action, where PageHeader stacks the bare <button> full-width on
    // mobile — so return the fragment directly, not wrapped in a <div>.
    return compact ? <div>{content}</div> : content;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {!fixedPropertyId && (
          <label className="text-sm">
            <span className="text-fg">Property</span>
            <select
              name="propertyId"
              required
              defaultValue=""
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            >
              <option value="" disabled>
                Select…
              </option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.unitNumber}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="text-fg">Visitor name</span>
          <input
            name="visitorName"
            required
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>
        <label className="text-sm">
          <span className="text-fg">Valid from</span>
          <input
            name="validFrom"
            type="datetime-local"
            required
            defaultValue={toLocalInput(now)}
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>
        <label className="text-sm">
          <span className="text-fg">Valid until</span>
          <input
            name="validUntil"
            type="datetime-local"
            required
            defaultValue={toLocalInput(tomorrow)}
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>
      </div>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create pass"}
        </button>
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
      </div>
    </form>
  );
}
