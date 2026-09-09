"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CommunityType } from "@prisma/client";
import { COMMUNITY_TYPE_OPTIONS } from "@/lib/community";
import { updateCommunityType } from "./actions";

export function CommunityTypeForm({ current }: { current: CommunityType }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [value, setValue] = useState<string>(current);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await updateCommunityType({ communityType: value });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-lg border border-border bg-surface p-4"
    >
      <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-fg-muted">
        This only changes the words the app uses (&ldquo;homeowner&rdquo; vs
        &ldquo;unit owner&rdquo;, &ldquo;Board of Trustees&rdquo; vs &ldquo;Board
        of Directors&rdquo;, and so on). Dues rates and vote weighting have their
        own settings and are left untouched.
      </p>
      {COMMUNITY_TYPE_OPTIONS.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer gap-2.5 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
        >
          <input
            type="radio"
            name="communityType"
            value={o.value}
            checked={value === o.value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-fg">{o.label}</span>
            <span className="block text-xs text-fg-muted">{o.hint}</span>
          </span>
        </label>
      ))}

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending || !value || value === current}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && !pending && <span className="text-sm text-success-fg">Saved</span>}
      </div>
    </form>
  );
}
