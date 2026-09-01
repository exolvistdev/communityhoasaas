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
          className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          New gate pass
        </button>
        {code && (
          <p className="mt-2 text-center text-sm text-green-700">
            Created — code <span className="font-mono font-semibold">{code}</span>
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
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <label className="block text-sm">
        <span className="text-gray-700">Visitor name</span>
        <input
          name="visitorName"
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-700">Valid from</span>
        <input
          name="validFrom"
          type="datetime-local"
          required
          defaultValue={toLocalInput(now)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-700">Valid until</span>
        <input
          name="validUntil"
          type="datetime-local"
          required
          defaultValue={toLocalInput(tomorrow)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create pass"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
