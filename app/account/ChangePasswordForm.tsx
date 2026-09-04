"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } from "@/lib/password";

export function ChangePasswordForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setSaved(false);
    if (!isStrongPassword(password)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setError(error.message);
      else {
        setSaved(true);
        form.reset();
        setPassword("");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm">
        <span className="text-fg">New password</span>
        <input
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 10 characters"
          className="mt-1 w-full rounded-md border border-border px-3 py-2 outline-none focus:border-brand"
        />
        <PasswordChecklist password={password} />
      </label>
      {error && <p className="text-sm text-danger-fg">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !isStrongPassword(password)}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Change password"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-success-fg">Updated</span>
        )}
      </div>
    </form>
  );
}
