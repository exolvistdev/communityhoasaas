"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementPublished,
  updateAnnouncement,
} from "./actions";

type Item = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  updatedAt: string;
  author: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function AnnouncementsManager({ items }: { items: Item[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setCreating(false);
        setEditingId(null);
        router.refresh();
      } else setError(res.error ?? "Something went wrong");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Announcements</h1>
        {!creating && (
          <button
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            New announcement
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {creating && (
        <AnnouncementForm
          pending={pending}
          onCancel={() => setCreating(false)}
          onSubmit={(data, publish) =>
            act(() => createAnnouncement({ ...data, publish }))
          }
          showPublish
        />
      )}

      {items.length === 0 && !creating ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No announcements yet. Post one for your homeowners.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a) =>
            editingId === a.id ? (
              <li key={a.id}>
                <AnnouncementForm
                  initial={a}
                  pending={pending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(data) =>
                    act(() => updateAnnouncement(a.id, data))
                  }
                />
              </li>
            ) : (
              <li
                key={a.id}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{a.title}</h3>
                      {a.publishedAt ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Published {fmt(a.publishedAt)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                      {a.body}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      Updated {fmt(a.updatedAt)} · {a.author}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-3 border-t border-gray-100 pt-3 text-xs">
                  <button
                    onClick={() => {
                      setEditingId(a.id);
                      setCreating(false);
                    }}
                    className="text-gray-500 underline hover:text-gray-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      act(() =>
                        setAnnouncementPublished(a.id, !a.publishedAt)
                      )
                    }
                    className="text-gray-500 underline hover:text-gray-900"
                  >
                    {a.publishedAt ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm(`Delete "${a.title}"?`)) return;
                      act(() => deleteAnnouncement(a.id));
                    }}
                    className="text-red-500 underline hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

function AnnouncementForm({
  initial,
  pending,
  showPublish,
  onCancel,
  onSubmit,
}: {
  initial?: { title: string; body: string };
  pending: boolean;
  showPublish?: boolean;
  onCancel: () => void;
  onSubmit: (data: { title: string; body: string }, publish?: boolean) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <label className="block text-sm">
        <span className="text-gray-700">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-700">Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 outline-none focus:border-gray-900"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {showPublish ? (
          <>
            <button
              onClick={() => onSubmit({ title, body }, false)}
              disabled={pending}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Save as draft
            </button>
            <button
              onClick={() => onSubmit({ title, body }, true)}
              disabled={pending}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {pending ? "Publishing…" : "Publish"}
            </button>
          </>
        ) : (
          <button
            onClick={() => onSubmit({ title, body })}
            disabled={pending}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        )}
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
