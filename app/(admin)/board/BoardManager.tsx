"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TrusteePosition } from "@prisma/client";
import { trusteePositions } from "@/lib/election";
import { useTerms } from "@/components/TermsProvider";
import type { TrusteeRow } from "@/lib/board";
import {
  ResponsiveTable,
  type ResponsiveColumn,
} from "@/components/ui/responsive-table";
import { setTrusteePosition, endTrusteeTerm, removeTrustee } from "./actions";

const fmt = (d: Date) =>
  new Date(d).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function BoardManager({ trustees }: { trustees: TrusteeRow[] }) {
  const positions = trusteePositions(useTerms());
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

  const columns: ResponsiveColumn<TrusteeRow>[] = [
    {
      key: "name",
      header: "Trustee",
      card: "title",
      cell: (t) => (
        <>
          <div className="text-fg">{t.name}</div>
          <div className="text-xs text-fg-subtle">
            {t.unitNumber ?? "—"}
            {t.fromElection ? " · elected" : " · appointed"}
          </div>
        </>
      ),
    },
    {
      key: "position",
      header: "Position",
      cell: (t) => (
        <select
          value={t.position}
          disabled={pending}
          onChange={(e) =>
            run(() =>
              setTrusteePosition(t.id, e.target.value as TrusteePosition)
            )
          }
          aria-label={`Officer position for ${t.name}`}
          className="rounded-md border border-border px-2 py-1 text-sm outline-none focus:border-brand disabled:opacity-50"
        >
          {positions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "termEnd",
      header: "Term",
      className: "text-xs text-fg-subtle",
      cell: (t) => `through ${fmt(t.termEnd)}`,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      card: "action",
      cell: (t) => (
        <>
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
        </>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      <ResponsiveTable columns={columns} rows={trustees} rowKey={(t) => t.id} hideHeader />
      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </div>
  );
}
