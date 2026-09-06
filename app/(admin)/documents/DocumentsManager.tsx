"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Upload, Download } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/PageHeader";
import {
  uploadDocumentAction,
  updateDocumentAction,
  deleteDocumentAction,
} from "./actions";

type Category = { value: string; label: string };

type Item = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileName: string;
  sizeBytes: number;
  staffOnly: boolean;
  uploadedBy: string | null;
  createdAt: string;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsManager({
  canWrite,
  categories,
  items,
}: {
  canWrite: boolean;
  categories: Category[];
  items: Item[];
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const labelOf = (v: string) =>
    categories.find((c) => c.value === v)?.label ?? v;

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setUploading(false);
        setEditingId(null);
        router.refresh();
      } else setError(res.error ?? "Something went wrong");
    });
  }

  const groups = categories
    .map((c) => ({
      ...c,
      docs: items.filter((d) => d.category === c.value),
    }))
    .filter((g) => g.docs.length > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description="Bylaws, minutes, financials and forms. Homeowners see everything except items marked staff-only."
        action={
          canWrite && !uploading ? (
            <button
              onClick={() => {
                setUploading(true);
                setEditingId(null);
              }}
              className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
            >
              <Upload className="h-4 w-4" /> Upload document
            </button>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      {uploading && (
        <DocForm
          categories={categories}
          pending={pending}
          withFile
          submitLabel="Upload"
          onCancel={() => setUploading(false)}
          onSubmit={(fd) => act(() => uploadDocumentAction(fd))}
        />
      )}

      {groups.length === 0 && !uploading ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description={
            canWrite
              ? "Upload your bylaws, board minutes and financial statements so homeowners can find them."
              : "Your HOA hasn't published any documents yet."
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.value} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                {g.label}
              </h2>
              <ul className="overflow-hidden rounded-lg border border-border bg-surface">
                {g.docs.map((d) =>
                  editingId === d.id ? (
                    <li key={d.id} className="border-b border-border p-4 last:border-0">
                      <DocForm
                        categories={categories}
                        pending={pending}
                        initial={d}
                        submitLabel="Save changes"
                        onCancel={() => setEditingId(null)}
                        onSubmit={(fd) =>
                          act(() => updateDocumentAction(d.id, fd))
                        }
                      />
                    </li>
                  ) : (
                    <li
                      key={d.id}
                      className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0"
                    >
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/documents/${d.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-fg hover:underline"
                          >
                            {d.title}
                          </a>
                          {d.staffOnly && (
                            <span className="flex items-center gap-1 rounded-full bg-warning-subtle px-1.5 py-0.5 text-[11px] font-medium text-warning-fg">
                              <Lock className="h-3 w-3" /> Staff only
                            </span>
                          )}
                        </div>
                        {d.description && (
                          <p className="mt-0.5 text-xs text-fg-muted">
                            {d.description}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-fg-subtle">
                          {d.fileName} · {sizeLabel(d.sizeBytes)} ·{" "}
                          {fmtDate(d.createdAt)}
                          {d.uploadedBy ? ` · ${d.uploadedBy}` : ""}
                        </p>
                        {canWrite && (
                          <div className="mt-2 flex gap-3 text-xs">
                            <button
                              onClick={() => {
                                setEditingId(d.id);
                                setUploading(false);
                              }}
                              className="text-fg-muted underline hover:text-fg"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (!confirm(`Delete "${d.title}"?`)) return;
                                act(() => deleteDocumentAction(d.id));
                              }}
                              className="text-danger-fg underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                      <a
                        href={`/documents/${d.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-md p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg"
                        aria-label={`Download ${d.title}`}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </li>
                  )
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function DocForm({
  categories,
  pending,
  initial,
  withFile,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  categories: Category[];
  pending: boolean;
  initial?: Item;
  withFile?: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      {withFile && (
        <label className="block text-sm">
          <span className="text-fg">File</span>
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            className="mt-1 block w-full text-sm text-fg-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-fg"
          />
          <span className="mt-1 block text-xs text-fg-subtle">
            PDF, Word, Excel or image. Up to 20 MB.
          </span>
        </label>
      )}

      <label className="block text-sm">
        <span className="text-fg">Title</span>
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={initial?.title}
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-fg">Category</span>
          <select
            name="category"
            defaultValue={initial?.category ?? "OTHER"}
            className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 outline-none focus:border-brand"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
          <input
            name="staffOnly"
            type="checkbox"
            defaultChecked={initial?.staffOnly}
            className="h-4 w-4"
          />
          <span className="text-fg">Staff only (hide from homeowners)</span>
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-fg">Description (optional)</span>
        <textarea
          name="description"
          rows={2}
          maxLength={2000}
          defaultValue={initial?.description ?? ""}
          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 outline-none focus:border-brand"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
