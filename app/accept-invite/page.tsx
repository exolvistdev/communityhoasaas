"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Phase = "checking" | "ready" | "no-session" | "done";

export default function AcceptInvitePage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let tries = 0;
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? null);
        setPhase("ready");
      } else if (tries++ < 5) {
        setTimeout(check, 400);
      } else {
        setPhase("no-session");
      }
    };
    check();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPhase("done");
    window.location.href = "/";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-xl font-semibold text-gray-900">
        Set your password
      </h1>

      {phase === "checking" && (
        <p className="mt-2 text-sm text-gray-500">Checking your invite…</p>
      )}

      {phase === "no-session" && (
        <p className="mt-2 text-sm text-red-600">
          This invite link is invalid or has expired. Ask an admin to send a new
          one.
        </p>
      )}

      {(phase === "ready" || phase === "done") && (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          {email && (
            <p className="text-sm text-gray-500">
              Signing in as <span className="text-gray-900">{email}</span>
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || phase === "done"}
            className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Set password & continue"}
          </button>
        </form>
      )}
    </main>
  );
}
