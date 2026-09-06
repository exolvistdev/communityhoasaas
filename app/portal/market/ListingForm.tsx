"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LISTING_CATEGORIES, publicPhotoUrl, MAX_LISTING_PHOTOS } from "@/lib/marketplace";
import { createListing, updateListing } from "./actions";

type Initial = {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  photos: string[];
};

/** Shrink a picked image to keep uploads small; falls back to the original. */
async function downscale(file: File, max = 1200): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", 0.85)
    );
    return blob
      ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
          type: "image/jpeg",
        })
      : file;
  } catch {
    return file;
  }
}

export function ListingForm({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [keptPhotos, setKeptPhotos] = useState<string[]>(initial?.photos ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const slots = keptPhotos.length + newFiles.length;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_LISTING_PHOTOS - slots;
    setNewFiles((f) => [...f, ...Array.from(list).slice(0, room)]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const raw = new FormData(form);
    setError(null);

    start(async () => {
      const fd = new FormData();
      fd.set("title", String(raw.get("title") ?? ""));
      fd.set("description", String(raw.get("description") ?? ""));
      fd.set("category", String(raw.get("category") ?? ""));
      fd.set("price", String(raw.get("price") ?? ""));
      for (const p of initial?.photos ?? [])
        if (!keptPhotos.includes(p)) fd.append("removePhotos", p);
      for (const file of newFiles) fd.append("photos", await downscale(file));

      if (initial) {
        const res = await updateListing(initial.id, fd);
        if (res.ok) {
          router.push(`/portal/market/${initial.id}`);
          router.refresh();
        } else setError(res.error);
      } else {
        const res = await createListing(fd);
        if (res.ok) {
          router.push(`/portal/market/${res.id}`);
          router.refresh();
        } else setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="text-fg">Title</span>
        <input
          name="title"
          required
          defaultValue={initial?.title}
          maxLength={120}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-fg">Category</span>
          <select
            name="category"
            defaultValue={initial?.category ?? "OTHER"}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-brand"
          >
            {LISTING_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-fg">Price (₱)</span>
          <input
            name="price"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={initial?.price}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-fg">Description</span>
        <textarea
          name="description"
          required
          rows={5}
          defaultValue={initial?.description}
          maxLength={4000}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
      </label>

      <div className="text-sm">
        <span className="text-fg">Photos ({slots}/{MAX_LISTING_PHOTOS})</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {keptPhotos.map((p) => (
            <div key={p} className="relative h-20 w-20">
              <img
                src={publicPhotoUrl(p)}
                alt=""
                className="h-20 w-20 rounded-md object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  setKeptPhotos((cur) => cur.filter((x) => x !== p))
                }
                className="absolute -right-1.5 -top-1.5 rounded-full bg-brand px-1.5 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
          {newFiles.map((f, i) => (
            <div key={i} className="relative h-20 w-20">
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="h-20 w-20 rounded-md object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  setNewFiles((cur) => cur.filter((_, x) => x !== i))
                }
                className="absolute -right-1.5 -top-1.5 rounded-full bg-brand px-1.5 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
          {slots < MAX_LISTING_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="h-20 w-20 rounded-md border border-dashed border-border text-2xl text-fg-subtle hover:border-border-strong"
            >
              +
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending
            ? "Saving…"
            : initial
            ? "Save changes"
            : "Post listing"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg px-4 py-2 text-sm text-fg-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
