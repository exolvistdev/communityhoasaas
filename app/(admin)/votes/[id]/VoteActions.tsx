"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VoteStatus } from "@prisma/client";
import {
  setVoteStatus,
  deleteVote,
  publishVoteResult,
  revokeProxyAsStaff,
} from "../actions";

// subset of lib/documents.ts MIME_EXT (server-only — not imported here)
const RESULT_ACCEPT =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function VoteActions({
  voteId,
  status,
  hasResult,
}: {
  voteId: string;
  status: VoteStatus;
  hasResult: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
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

  function onDelete() {
    if (!window.confirm("Delete this vote?")) return;
    start(async () => {
      const res = await deleteVote(voteId);
      if (res.ok) router.push("/votes");
      else setError(res.error);
    });
  }

  function onFile(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    run(() => publishVoteResult(voteId, fd));
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Manage</h2>

      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <>
            <button
              onClick={() => run(() => setVoteStatus(voteId, "OPEN"))}
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
              onClick={() => run(() => setVoteStatus(voteId, "CLOSED"))}
              disabled={pending}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
            >
              Close voting
            </button>
            <button
              onClick={() => run(() => setVoteStatus(voteId, "CANCELLED"))}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-sm text-danger-fg hover:bg-danger-subtle disabled:opacity-50"
            >
              Cancel vote
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
        <div className="border-t border-border pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Result
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {hasResult
              ? "Published to the document library. Upload a new file to replace it."
              : "Upload the signed result / minutes. Residents are notified and can read it in the document library."}
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
            className="mt-2 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Uploading…" : hasResult ? "Replace result" : "Publish result"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </section>
  );
}

export function RevokeProxyButton({ proxyId }: { proxyId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          await revokeProxyAsStaff(proxyId);
          router.refresh();
        })
      }
      disabled={pending}
      className="rounded-md px-2 py-1 text-xs text-danger-fg hover:bg-danger-subtle disabled:opacity-50"
    >
      Revoke
    </button>
  );
}
