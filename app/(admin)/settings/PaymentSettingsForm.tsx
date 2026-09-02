"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentSettings, setPaymentQr, removePaymentQr } from "./actions";

// kept in sync with MIME_EXT in lib/payment-qr.ts (server-only — not imported here)
const QR_ACCEPT = "image/png,image/jpeg,image/webp";

type OrgPayments = {
  gcashNumber: string | null;
  gcashName: string | null;
  mayaNumber: string | null;
  mayaName: string | null;
  paymentInstructions: string | null;
};

export function PaymentSettingsForm({
  org,
  gcashQrUrl,
  mayaQrUrl,
}: {
  org: OrgPayments;
  gcashQrUrl: string | null;
  mayaQrUrl: string | null;
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
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="GCash number" name="gcashNumber" defaultValue={org.gcashNumber} placeholder="0917 000 0000" />
        <Field label="GCash account name" name="gcashName" defaultValue={org.gcashName} />
        <Field label="Maya number" name="mayaNumber" defaultValue={org.mayaNumber} placeholder="0917 000 0000" />
        <Field label="Maya account name" name="mayaName" defaultValue={org.mayaName} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QrUpload wallet="gcash" label="GCash QR" currentUrl={gcashQrUrl} />
        <QrUpload wallet="maya" label="Maya QR" currentUrl={mayaQrUrl} />
      </div>
      <p className="text-xs text-fg-subtle">
        Export your &ldquo;Receive Money&rdquo; QR from the GCash / Maya app and
        upload it here — a payment QR can&apos;t be generated from a phone number
        alone. Homeowners see it on the Pay Now screen.
      </p>

      <label className="block text-sm">
        <span className="text-fg">Bank transfer &amp; cash instructions</span>
        <textarea
          name="paymentInstructions"
          rows={4}
          defaultValue={org.paymentInstructions ?? ""}
          placeholder="Bank: BDO 1234-5678-90 (Sample HOA). Cash: HOA office, Mon–Fri 9am–5pm."
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
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

function QrUpload({
  wallet,
  label,
  currentUrl,
}: {
  wallet: "gcash" | "maya";
  label: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("wallet", wallet);
    fd.set("file", file);
    start(async () => {
      const res = await setPaymentQr(fd);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function remove() {
    setError(null);
    start(async () => {
      const res = await removePaymentQr(wallet);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="text-sm">
      <span className="text-fg">{label}</span>
      <div className="mt-1 flex items-start gap-3">
        {currentUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={currentUrl}
            alt={`${label} code`}
            className="h-20 w-20 rounded-md border border-border object-contain bg-white"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-center text-[10px] text-fg-subtle">
            No QR
          </div>
        )}
        <div className="space-y-1">
          <input
            ref={inputRef}
            type="file"
            accept={QR_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="block rounded-md border border-border bg-surface px-2.5 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
          >
            {pending ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
          </button>
          {currentUrl && !pending && (
            <button
              type="button"
              onClick={remove}
              className="block text-xs text-danger-fg hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-danger-fg">{error}</p>}
    </div>
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
      <span className="text-fg">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
      />
    </label>
  );
}
