"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signIn } from "./actions";

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await signIn({
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
      });
      if (res.ok) {
        router.push(next);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="block text-sm font-medium text-slate-700">Email</span>
        <input name="email" type="email" required autoFocus className={inputClass} />
      </label>

      <label className="block space-y-1.5">
        <span className="flex items-center justify-between text-sm font-medium text-slate-700">
          Password
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            Forgot?
          </Link>
        </span>
        <input name="password" type="password" required className={inputClass} />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-base font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </button>
    </form>
  );
}
