"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantProxy, revokeProxy } from "./actions";

type Unit = { id: string; unitNumber: string };
type Proxy = { id: string; unitNumber: string; holderName: string };

export function ProxyManager({
  units,
  proxies,
}: {
  units: Unit[];
  proxies: Proxy[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const proxyFor = new Map(proxies.map((p) => [p.unitNumber, p]));

  function onGrant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await grantProxy({
        grantorPropertyId: fd.get("grantorPropertyId"),
        holderEmail: fd.get("holderEmail"),
        note: fd.get("note"),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  function onRevoke(id: string) {
    start(async () => {
      await revokeProxy(id);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Proxy voting</h2>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            Assign a proxy
          </button>
        )}
      </div>
      <p className="text-xs text-fg-muted">
        Can&apos;t vote yourself? Assign another member to cast your unit&apos;s
        ballot. They vote for you until you revoke it.
      </p>

      <ul className="space-y-1 text-sm">
        {units.map((u) => {
          const p = proxyFor.get(u.unitNumber);
          return (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span className="text-fg">
                {u.unitNumber}
                {p ? (
                  <span className="ml-2 text-xs text-fg-muted">→ {p.holderName}</span>
                ) : (
                  <span className="ml-2 text-xs text-fg-subtle">no proxy</span>
                )}
              </span>
              {p && (
                <button
                  onClick={() => onRevoke(p.id)}
                  disabled={pending}
                  className="text-xs text-danger-fg hover:underline disabled:opacity-50"
                >
                  Revoke
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {open && (
        <form
          onSubmit={onGrant}
          className="space-y-2 rounded-md border border-border p-3"
        >
          <label className="block text-sm">
            <span className="text-fg">Your unit</span>
            <select
              name="grantorPropertyId"
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-fg">Member&apos;s email</span>
            <input
              name="holderEmail"
              type="email"
              required
              placeholder="member@example.com"
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="text-fg">Note (optional)</span>
            <input
              name="note"
              placeholder="e.g. for the 2027 budget vote"
              className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
            />
          </label>
          {error && <p className="text-sm text-danger-fg">{error}</p>}
          <div className="flex justify-end gap-2">
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
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Assign"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
