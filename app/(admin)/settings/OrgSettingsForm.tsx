"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrgSettings } from "./actions";

export function OrgSettingsForm({
  org,
}: {
  org: { name: string; billingDueDay: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateOrgSettings({
        name: fd.get("name"),
        billingDueDay: fd.get("billingDueDay"),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-gray-700">HOA name</span>
          <input
            name="name"
            defaultValue={org.name}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
          />
        </label>
        <label className="text-sm">
          <span className="text-gray-700">Invoice due day (of month)</span>
          <input
            name="billingDueDay"
            type="number"
            min="1"
            max="28"
            defaultValue={org.billingDueDay}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
          />
        </label>
      </div>

      <p className="text-xs text-gray-400">
        The due day applies to invoices generated from now on; existing invoices
        keep their due date.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-green-700">Saved</span>
        )}
      </div>
    </form>
  );
}
