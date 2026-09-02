"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateHomeownerContact } from "./actions";

export function ContactForm({
  phone,
  email,
}: {
  phone: string | null;
  email: string | null;
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
      const res = await updateHomeownerContact({
        phone: fd.get("phone"),
        email: fd.get("email"),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm">
        <span className="text-fg">Contact email</span>
        <input
          name="email"
          type="email"
          defaultValue={email ?? ""}
          placeholder="Shown to your HOA office"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>
      <label className="block text-sm">
        <span className="text-fg">Contact phone</span>
        <input
          name="phone"
          defaultValue={phone ?? ""}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
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
