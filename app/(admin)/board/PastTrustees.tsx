"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TRUSTEE_POSITION_LABEL } from "@/lib/election";
import type { TrusteeRow } from "@/lib/board";
import { reactivateTrusteeAction } from "./actions";

const fmt = (d: Date) =>
  new Date(d).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function PastTrustees({ trustees }: { trustees: TrusteeRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const now = Date.now();

  function reactivate(id: string, name: string) {
    if (!window.confirm(`Put ${name} back on the board?`)) return;
    setError(null);
    start(async () => {
      const res = await reactivateTrusteeAction(id);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong");
    });
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <tbody>
            {trustees.map((t) => {
              // ended early and the term hasn't run out yet → can be reinstated
              const canReactivate =
                t.endedAt != null && new Date(t.termEnd).getTime() > now;
              return (
                <tr key={t.id} className="border-t border-border first:border-t-0">
                  <td className="px-4 py-2 text-fg">{t.name}</td>
                  <td className="px-4 py-2 text-fg-muted">
                    {TRUSTEE_POSITION_LABEL[t.position]}
                  </td>
                  <td className="px-4 py-2 text-xs text-fg-subtle">
                    {fmt(t.termStart)} – {fmt(t.termEnd)}
                    {t.endedAt ? ` · ended ${fmt(t.endedAt)}` : ""}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canReactivate && (
                      <button
                        onClick={() => reactivate(t.id, t.name)}
                        disabled={pending}
                        className="text-xs text-brand-accent hover:underline disabled:opacity-50"
                      >
                        reactivate
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
