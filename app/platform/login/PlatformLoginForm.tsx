"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInPlatform } from "./actions";

export function PlatformLoginForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await signInPlatform({
        email: fd.get("email"),
        password: fd.get("password"),
      });
      if (res.ok) {
        router.push("/platform");
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300">
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          autoFocus
          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300">
          Password
        </label>
        <input
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-gray-400"
        />
      </div>
      {error && (
        <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
