"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestGatePass } from "../actions";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function RequestGatePassForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (!open) {
    return (
      <div>
        <button
          onClick={() => {
            setOpen(true);
            setCode(null);
          }}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:brightness-110"
        >
          New gate pass
        </button>
        {code && (
          <p className="mt-2 text-center text-sm text-success-fg">
            Created — code{" "}
            <a
              href={`/pass/${code}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono font-semibold underline"
            >
              {code}
            </a>
            <br />
            <span className="text-xs text-fg-muted">
              Open it to get a QR / link to send your visitor.
            </span>
          </p>
        )}
      </div>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await requestGatePass({
        visitorName: fd.get("visitorName"),
        validFrom: fd.get("validFrom"),
        validUntil: fd.get("validUntil"),
      });
      if (res.ok) {
        setCode(res.code);
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <label className="block text-sm">
        <span className="text-fg">Visitor name</span>
        <input
          name="visitorName"
          required
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>
      <label className="block text-sm">
        <span className="text-fg">Valid from</span>
        <input
          name="validFrom"
          type="datetime-local"
          required
          defaultValue={toLocalInput(now)}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>
      <label className="block text-sm">
        <span className="text-fg">Valid until</span>
        <input
          name="validUntil"
          type="datetime-local"
          required
          defaultValue={toLocalInput(tomorrow)}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>

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
