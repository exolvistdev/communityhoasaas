"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { peso, periodLabel } from "@/lib/format";
import { generateMonthlyInvoices, previewGeneration } from "./actions";

export function GenerateInvoicesButton({ period }: { period: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<{ count: number; total: number } | null>(
    null
  );
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPreview, startPreview] = useTransition();
  const [generating, startGenerate] = useTransition();

  function openConfirm() {
    setError(null);
    setDone(null);
    startPreview(async () => {
      const p = await previewGeneration(period);
      setPreview(p);
    });
  }

  function confirm() {
    startGenerate(async () => {
      const res = await generateMonthlyInvoices(period);
      if (res.ok) {
        setDone(res.created);
        setPreview(null);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <>
      <button
        onClick={openConfirm}
        disabled={loadingPreview}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
      >
        {loadingPreview ? "Checking…" : "Generate monthly invoices"}
      </button>

      {done !== null && (
        <p className="mt-2 text-sm text-success-fg">
          {done === 0
            ? "All properties are already billed for this period."
            : `${done} invoice${done === 1 ? "" : "s"} generated.`}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-danger-fg">{error}</p>}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg">
            <h2 className="text-base font-semibold text-fg">
              Generate invoices for {periodLabel(period)}?
            </h2>
            {preview.count === 0 ? (
              <p className="mt-2 text-sm text-fg-muted">
                Every property already has an invoice for this period. Nothing to
                do.
              </p>
            ) : (
              <p className="mt-2 text-sm text-fg-muted">
                This will create{" "}
                <span className="font-medium text-fg">
                  {preview.count} invoice{preview.count === 1 ? "" : "s"}
                </span>{" "}
                totalling{" "}
                <span className="font-medium text-fg">
                  {peso(preview.total)}
                </span>
                , one per property at its configured rate, and post them to the
                ledger.
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPreview(null)}
                className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2"
              >
                Cancel
              </button>
              {preview.count > 0 && (
                <button
                  onClick={confirm}
                  disabled={generating}
                  className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
                >
                  {generating ? "Generating…" : `Generate ${preview.count}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
