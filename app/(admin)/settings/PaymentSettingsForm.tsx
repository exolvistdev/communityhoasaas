"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentSettings } from "./actions";

type OrgPayments = {
  gcashNumber: string | null;
  gcashName: string | null;
  mayaNumber: string | null;
  mayaName: string | null;
  paymentInstructions: string | null;
};

export function PaymentSettingsForm({ org }: { org: OrgPayments }) {
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
      const res = await updatePaymentSettings({
        gcashNumber: fd.get("gcashNumber"),
        gcashName: fd.get("gcashName"),
        mayaNumber: fd.get("mayaNumber"),
        mayaName: fd.get("mayaName"),
        paymentInstructions: fd.get("paymentInstructions"),
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
        <Field label="GCash number" name="gcashNumber" defaultValue={org.gcashNumber} placeholder="0917 000 0000" />
        <Field label="GCash account name" name="gcashName" defaultValue={org.gcashName} />
        <Field label="Maya number" name="mayaNumber" defaultValue={org.mayaNumber} placeholder="0917 000 0000" />
        <Field label="Maya account name" name="mayaName" defaultValue={org.mayaName} />
      </div>
      <label className="block text-sm">
        <span className="text-gray-700">
          Bank transfer &amp; cash instructions
        </span>
        <textarea
          name="paymentInstructions"
          rows={4}
          defaultValue={org.paymentInstructions ?? ""}
          placeholder="Bank: BDO 1234-5678-90 (Sample HOA). Cash: HOA office, Mon–Fri 9am–5pm."
          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-gray-900"
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

function Field({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  placeholder?: string;
}) {
  return (
    <label className="text-sm">
      <span className="text-gray-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
      />
    </label>
  );
}
