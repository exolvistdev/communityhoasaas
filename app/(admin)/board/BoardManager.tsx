"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TrusteePosition } from "@prisma/client";
import { TRUSTEE_POSITIONS } from "@/lib/election";
import type { TrusteeRow } from "@/lib/board";
import { setTrusteePosition, endTrusteeTerm, removeTrustee } from "./actions";

const fmt = (d: Date) =>
  new Date(d).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function BoardManager({ trustees }: { trustees: TrusteeRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong");
    });
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <tbody>
            {trustees.map((t) => (
              <tr key={t.id} className="border-t border-border first:border-t-0">
                <td className="px-4 py-2">
                  <div className="text-fg">{t.name}</div>
                  <div className="text-xs text-fg-subtle">
                    {t.unitNumber ?? "—"}
                    {t.fromElection ? " · elected" : " · appointed"}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={t.position}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        setTrusteePosition(
                          t.id,
                          e.target.value as TrusteePosition
                        )
                      )
                    }
                    className="rounded-md border border-border px-2 py-1 text-sm outline-none focus:border-brand disabled:opacity-50"
                  >
                    {TRUSTEE_POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-xs text-fg-subtle">
                  through {fmt(t.termEnd)}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => {
                      if (window.confirm(`End ${t.name}'s term now?`))
                        run(() => endTrusteeTerm(t.id));
                    }}
                    disabled={pending}
                    className="text-xs text-fg-muted hover:underline disabled:opacity-50"
                  >
                    end term
                  </button>
                  {!t.fromElection && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete ${t.name}?`))
                          run(() => removeTrustee(t.id));
                      }}
                      disabled={pending}
                      className="ml-3 text-xs text-danger-fg hover:underline disabled:opacity-50"
                    >
                      delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
