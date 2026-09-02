"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrgSettings } from "./actions";

export function OrgSettingsForm({
  org,
}: {
  org: {
    name: string;
    billingDueDay: number;
    privacyContactEmail: string | null;
  };
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
        privacyContactEmail: fd.get("privacyContactEmail"),
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
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-fg">HOA name</span>
          <input
            name="name"
            defaultValue={org.name}
            required
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>
        <label className="text-sm">
          <span className="text-fg">Invoice due day (of month)</span>
          <input
            name="billingDueDay"
            type="number"
            min="1"
            max="28"
            defaultValue={org.billingDueDay}
            required
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
          />
        </label>
      </div>

      <p className="text-xs text-fg-subtle">
        The due day applies to invoices generated from now on; existing invoices
        keep their due date.
      </p>

      <label className="block text-sm">
        <span className="text-fg">Data-privacy contact email</span>
        <input
          name="privacyContactEmail"
          type="email"
          defaultValue={org.privacyContactEmail ?? ""}
          placeholder="dpo@yourhoa.ph"
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
        />
        <span className="mt-1 block text-xs text-fg-subtle">
          Shown to residents on their account page for data-privacy questions
          (RA 10173).
        </span>
      </label>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-success-fg">Saved</span>
        )}
      </div>
    </form>
  );
}
