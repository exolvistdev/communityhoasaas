"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ElectionStatus } from "@prisma/client";
import { addCandidate, removeCandidate, withdrawCandidate } from "../actions";

type Candidate = {
  id: string;
  name: string;
  bio: string | null;
  withdrawn: boolean;
  ineligible: boolean;
  votes: number;
};

export function CandidateManager({
  electionId,
  status,
  candidates,
  pool,
}: {
  electionId: string;
  status: ElectionStatus;
  candidates: Candidate[];
  pool: { id: string; label: string; suspended: boolean }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"member" | "name">("member");

  const isDraft = status === "DRAFT";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong");
    });
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    run(async () => {
      const res = await addCandidate(electionId, {
        homeownerId: mode === "member" ? fd.get("homeownerId") : "",
        name: mode === "name" ? fd.get("name") : "",
        bio: fd.get("bio"),
      });
      if (res.ok) form.reset();
      return res;
    });
  }

  const field =
    "rounded-md border border-border px-2 py-1.5 text-sm outline-none focus:border-brand";

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-fg">
        Candidates <span className="text-fg-subtle">({candidates.length})</span>
      </h2>

      {candidates.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-t border-border first:border-t-0">
                  <td className="px-4 py-2">
                    <div
                      className={
                        c.withdrawn ? "text-fg-subtle line-through" : "text-fg"
                      }
                    >
                      {c.name}
                      {c.ineligible && !c.withdrawn && (
                        <span className="ml-2 text-xs font-medium text-warning-fg">
                          behind on dues
                        </span>
                      )}
                    </div>
                    {c.bio && (
                      <div className="text-xs text-fg-subtle">{c.bio}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-fg-muted tabular-nums">
                    {status !== "DRAFT" && `${c.votes} vote${c.votes === 1 ? "" : "s"}`}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isDraft ? (
                      <button
                        onClick={() => run(() => removeCandidate(c.id))}
                        disabled={pending}
                        className="text-xs text-danger-fg hover:underline disabled:opacity-50"
                      >
                        remove
                      </button>
                    ) : status === "OPEN" ? (
                      <button
                        onClick={() =>
                          run(() => withdrawCandidate(c.id, !c.withdrawn))
                        }
                        disabled={pending}
                        className="text-xs text-brand-accent hover:underline disabled:opacity-50"
                      >
                        {c.withdrawn ? "reinstate" : "withdraw"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isDraft && (
        <form
          onSubmit={onAdd}
          className="space-y-2 rounded-lg border border-border bg-surface p-3"
        >
          <div className="flex gap-3 text-xs">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={mode === "member"}
                onChange={() => setMode("member")}
              />
              A member
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={mode === "name"}
                onChange={() => setMode("name")}
              />
              By name
            </label>
          </div>

          {mode === "member" ? (
            <select name="homeownerId" required className={`${field} w-full`}>
              <option value="">— pick a member —</option>
              {pool.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.suspended ? " (behind on dues)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="name"
              required
              placeholder="Candidate's full name"
              className={`${field} w-full`}
            />
          )}

          <textarea
            name="bio"
            rows={2}
            placeholder="Short bio / platform (optional)"
            className={`${field} w-full`}
          />

          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            Add candidate
          </button>
        </form>
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </section>
  );
}
