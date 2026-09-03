"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MeetingStatus } from "@prisma/client";
import {
  setMeetingStatus,
  deleteMeeting,
  publishMinutes,
} from "../actions";

// subset of lib/documents.ts MIME_EXT (server-only — not imported here)
const MINUTES_ACCEPT =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function MeetingActions({
  meetingId,
  status,
  hasMinutes,
  minutesFileName,
  minutesDocId,
}: {
  meetingId: string;
  status: MeetingStatus;
  hasMinutes: boolean;
  minutesFileName: string | null;
  minutesDocId: string | null;
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

  function toStatus(next: MeetingStatus) {
    run(() => setMeetingStatus(meetingId, next));
  }

  function onFile(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    run(() => publishMinutes(meetingId, fd));
  }

  function onDelete() {
    if (!window.confirm("Delete this meeting?")) return;
    start(async () => {
      const res = await deleteMeeting(meetingId);
      if (res.ok) router.push("/meetings");
      else setError(res.error);
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Manage</h2>

      <div className="flex flex-wrap gap-2">
        {status === "SCHEDULED" && (
          <>
            <button
              onClick={() => toStatus("HELD")}
              disabled={pending}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
            >
              Mark as held
            </button>
            <button
              onClick={() => toStatus("CANCELLED")}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-sm text-danger-fg hover:bg-danger-subtle disabled:opacity-50"
            >
              Cancel meeting
            </button>
          </>
        )}
        {status === "CANCELLED" && (
          <button
            onClick={() => toStatus("SCHEDULED")}
            disabled={pending}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            Reinstate
          </button>
        )}
        {status !== "HELD" && (
          <button
            onClick={onDelete}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {status !== "CANCELLED" && (
        <div className="border-t border-border pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            Minutes
          </div>
          {hasMinutes ? (
            <p className="mt-1 text-sm text-fg-muted">
              Published:{" "}
              {minutesDocId ? (
                <Link
                  href={`/documents/${minutesDocId}`}
                  className="text-fg underline underline-offset-2"
                >
                  {minutesFileName}
                </Link>
              ) : (
                minutesFileName
              )}
              . Upload a new file to replace it.
            </p>
          ) : (
            <p className="mt-1 text-sm text-fg-muted">
              Upload the signed minutes (PDF or Word). Residents will be notified
              and can read it from the document library.
            </p>
          )}
          <input
            ref={fileInput}
            type="file"
            accept={MINUTES_ACCEPT}
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
            {pending
              ? "Uploading…"
              : hasMinutes
              ? "Replace minutes"
              : "Publish minutes"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-danger-fg">{error}</p>}
    </section>
  );
}
