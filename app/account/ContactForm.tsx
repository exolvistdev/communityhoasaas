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
        <span className="text-gray-700">Contact email</span>
        <input
          name="email"
          type="email"
          defaultValue={email ?? ""}
          placeholder="Shown to your HOA office"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-700">Contact phone</span>
        <input
          name="phone"
          defaultValue={phone ?? ""}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
        />
      </label>
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
