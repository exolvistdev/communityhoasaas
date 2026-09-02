"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { requestAccountDeletion, cancelDataRequest } from "./actions";

export function PrivacySection({
  privacyContactEmail,
  pendingDeletion,
}: {
  privacyContactEmail: string | null;
  pendingDeletion: { id: string; createdAt: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <div className="space-y-4 text-sm">
      <div>
        <a
          href="/account/export"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 font-medium text-fg hover:bg-surface-2"
        >
          <Download className="h-4 w-4" /> Download my data
        </a>
        <p className="mt-1.5 text-xs text-fg-subtle">
          A JSON file of everything your HOA holds linked to your account.
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <div className="font-medium text-fg">Delete my account</div>
        <p className="mt-1 text-xs text-fg-muted">
          Your HOA reviews the request. Financial records (dues, payments) are
          kept as required by Philippine tax and audit rules; the rest of your
          personal data is removed and your login is revoked.
        </p>

        {pendingDeletion ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning-fg">
            <span>
              Deletion requested {fmt(pendingDeletion.createdAt)} — pending your
              HOA&apos;s review.
            </span>
            <button
              onClick={() => {
                setError(null);
                start(async () => {
                  const res = await cancelDataRequest(pendingDeletion.id);
                  if (res.ok) router.refresh();
                  else setError(res.error);
                });
              }}
              disabled={pending}
              className="font-medium underline disabled:opacity-50"
            >
              Cancel request
            </button>
          </div>
        ) : showForm ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Reason (optional)"
              className="w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (
                    !confirm(
                      "Request deletion of your account and personal data?"
                    )
                  )
                    return;
                  setError(null);
                  start(async () => {
                    const res = await requestAccountDeletion(
                      reason.trim() || undefined
                    );
                    if (res.ok) {
                      setShowForm(false);
                      router.refresh();
                    } else setError(res.error);
                  });
                }}
                disabled={pending}
                className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Request deletion"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 rounded-md border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger-fg hover:bg-danger-subtle"
          >
            Request account deletion
          </button>
        )}
      </div>

      {error && <p className="text-danger-fg">{error}</p>}

      <p className="border-t border-border pt-4 text-xs text-fg-subtle">
        Questions about your data?{" "}
        {privacyContactEmail ? (
          <a
            href={`mailto:${privacyContactEmail}`}
            className="text-brand-accent hover:underline"
          >
            {privacyContactEmail}
          </a>
        ) : (
          "Contact your HOA office."
        )}{" "}
        · <a href="/privacy" className="text-brand-accent hover:underline">Privacy policy</a>
      </p>
    </div>
  );
}
