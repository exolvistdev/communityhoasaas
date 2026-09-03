"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { downscale } from "@/lib/downscale";
import {
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_PHOTO_ACCEPT,
  MAINTENANCE_PHOTO_MAX,
} from "@/lib/maintenance";
import { createRequest } from "../actions";

export function NewRequestForm({ unitNumber }: { unitNumber: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [common, setCommon] = useState(!unitNumber);
  const fileInput = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((f) => [...f, ...Array.from(list)].slice(0, MAINTENANCE_PHOTO_MAX));
    if (fileInput.current) fileInput.current.value = "";
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("category", String(raw.get("category") ?? ""));
      fd.set("title", String(raw.get("title") ?? ""));
      fd.set("description", String(raw.get("description") ?? ""));
      fd.set("location", String(raw.get("location") ?? ""));
      fd.set("isCommonArea", common ? "true" : "false");
      for (const file of files) fd.append("photos", await downscale(file));

      const res = await createRequest(fd);
      if (res.ok) {
        router.push(`/portal/maintenance/${res.id}`);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="text-fg">Category</span>
        <select
          name="category"
          required
          defaultValue=""
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        >
          <option value="" disabled>
            Select…
          </option>
          {MAINTENANCE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-fg">Title</span>
        <input
          name="title"
          required
          placeholder="e.g. Kitchen sink leaking"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>

      <label className="block text-sm">
        <span className="text-fg">What&apos;s wrong?</span>
        <textarea
          name="description"
          rows={4}
          required
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>

      <label className="block text-sm">
        <span className="text-fg">Where exactly? (optional)</span>
        <input
          name="location"
          placeholder="e.g. under the kitchen sink"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={common}
          disabled={!unitNumber}
          onChange={(e) => setCommon(e.target.checked)}
        />
        This is a common-area issue{unitNumber ? ` (not ${unitNumber})` : ""}
      </label>

      <div className="text-sm">
        <span className="text-fg">Photos (optional, up to {MAINTENANCE_PHOTO_MAX})</span>
        <input
          ref={fileInput}
          type="file"
          accept={MAINTENANCE_PHOTO_ACCEPT}
          multiple
          onChange={(e) => addFiles(e.target.files)}
          className="mt-1 block w-full text-xs text-fg-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-2.5 file:py-1 file:text-xs"
        />
        {files.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-fg-subtle">
            {files.map((f, i) => (
              <li key={i} className="flex justify-between">
                {f.name}
                <button
                  type="button"
                  onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}
                  className="text-danger-fg"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
