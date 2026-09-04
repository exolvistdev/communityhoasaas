"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ElectionStatus } from "@prisma/client";
import {
  setElectionStatus,
  deleteElection,
  finalizeElectionAction,
  publishElectionResult,
} from "../actions";

const RESULT_ACCEPT =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function ElectionActions({
  electionId,
  status,
  finalized,
  canFinalize,
  hasResult,
}: {
  electionId: string;
  status: ElectionStatus;
  finalized: boolean;
  canFinalize: boolean;
  hasResult: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [setBoardRole, setSetBoardRole] = useState(true);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong");
    });
  }

  function onDelete() {
    if (!window.confirm("Delete this election?")) return;
    start(async () => {
      const res = await deleteElection(electionId);
      if (res.ok) router.push("/elections");
      else setError(res.error);
    });
  }

  function onFinalize() {
    if (
      !window.confirm(
        "Seat the winning candidates as trustees? This creates the board roster."
      )
    )
      return;
    setError(null);
    setMsg(null);
    start(async () => {
      const res = await finalizeElectionAction(electionId, setBoardRole);
      if (res.ok) {
        setMsg(`${res.trustees} trustee(s) seated.`);
        router.refresh();
      } else setError(res.error);
    });
  }

  function onFile(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    run(() => publishElectionResult(electionId, fd));
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Manage</h2>

      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <>
            <button
              onClick={() => run(() => setElectionStatus(electionId, "OPEN"))}
              disabled={pending}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              Open voting &amp; notify
            </button>
            <button
              onClick={onDelete}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2 disabled:opacity-50"
            >
              Delete
            </button>
          </>
        )}
        {status === "OPEN" && (
          <>
            <button
              onClick={() => run(() => setElectionStatus(electionId, "CLOSED"))}
              disabled={pending}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
            >
              Close voting
            </button>
            <button
              onClick={() => run(() => setElectionStatus(electionId, "CANCELLED"))}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-sm text-danger-fg hover:bg-danger-subtle disabled:opacity-50"
            >
              Cancel election
            </button>
          </>
        )}
        {status === "CANCELLED" && (
          <button
            onClick={onDelete}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {status === "CLOSED" && (
        <div className="space-y-3 border-t border-border pt-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              Seat the board
            </div>
            {finalized ? (
              <p className="mt-1 text-sm text-success-fg">
                Finalized — the winners are on the{" "}
                <a href="/board" className="underline">
                  board roster
                </a>
                .
              </p>
            ) : (
              <>
                <label className="mt-1 flex items-center gap-2 text-sm text-fg-muted">
                  <input
                    type="checkbox"
                    checked={setBoardRole}
                    onChange={(e) => setSetBoardRole(e.target.checked)}
                  />
                  Also give the winners the Board Member role
                </label>
                <button
                  onClick={onFinalize}
                  disabled={pending || !canFinalize}
                  className="mt-2 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
                >
                  {pending ? "Finalizing…" : "Finalize & seat trustees"}
                </button>
                {!canFinalize && (
                  <p className="mt-1 text-xs text-fg-subtle">
                    Needs quorum met and no tie for the last seat.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              Result document
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {hasResult
                ? "Published to the document library. Upload a new file to replace it."
                : "Upload the signed tally / minutes. Residents are notified."}
            </p>
            <input
              ref={fileInput}
              type="file"
              accept={RESULT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={pending}
              className="mt-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
            >
              {pending ? "Uploading…" : hasResult ? "Replace result" : "Publish result"}
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-success-fg">{msg}</p>}
      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </section>
  );
}
