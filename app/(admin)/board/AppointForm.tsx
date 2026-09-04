"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TRUSTEE_POSITIONS } from "@/lib/election";
import { addTrustee } from "./actions";

export function AppointForm({ pool }: { pool: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"member" | "name">("member");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        Appoint a trustee
      </button>
    );

  const field =
    "rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await addTrustee({
            homeownerId: mode === "member" ? fd.get("homeownerId") : "",
            name: mode === "name" ? fd.get("name") : "",
            position: fd.get("position"),
            termStart: fd.get("termStart"),
            termEnd: fd.get("termEnd"),
          });
          if (res.ok) {
            setOpen(false);
            router.refresh();
          } else setError(res.error);
        });
      }}
      className="max-w-md space-y-2 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "member"}
            onChange={() => setMode("member")}
          />
          A member
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "name"}
            onChange={() => setMode("name")}
          />
          By name
        </label>
      </div>

      {mode === "member" ? (
        <select name="homeownerId" required className={`${field} w-full`}>
          <option value="">— pick a member —</option>
          {pool.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          name="name"
          required
          placeholder="Trustee's full name"
          className={`${field} w-full`}
        />
      )}

      <label className="block text-sm">
        <span className="text-fg">Position</span>
        <select name="position" defaultValue="MEMBER" className={`mt-1 ${field} w-full`}>
          {TRUSTEE_POSITIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          <span className="text-fg">Term starts</span>
          <input name="termStart" type="date" required className={`mt-1 ${field} w-full`} />
        </label>
        <label className="block text-sm">
          <span className="text-fg">Term ends</span>
          <input name="termEnd" type="date" required className={`mt-1 ${field} w-full`} />
        </label>
      </div>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
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
          {pending ? "Adding…" : "Appoint"}
        </button>
      </div>
    </form>
  );
}
