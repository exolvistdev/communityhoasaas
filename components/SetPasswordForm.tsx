"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Field, Input, FormError } from "@/components/ui/field";

type Phase = "checking" | "ready" | "no-session" | "done";

export function SetPasswordForm({
  heading = "Set your password",
  ctaLabel = "Set password & continue",
  invalidLinkMessage = "This link is invalid or has expired. Ask an admin to send a new one.",
  redirectTo = "/",
}: {
  heading?: string;
  ctaLabel?: string;
  invalidLinkMessage?: string;
  redirectTo?: string;
}) {
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
    window.location.href = redirectTo;
  }

  return (
    <AuthShell
      title={heading}
      subtitle={email ? `Signing in as ${email}` : undefined}
    >
      {phase === "checking" && (
        <p className="text-sm text-fg-muted">Checking your link…</p>
      )}

      {phase === "no-session" && (
        <FormError>{invalidLinkMessage}</FormError>
      )}

      {(phase === "ready" || phase === "done") && (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="New password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </Field>
          {error && <FormError>{error}</FormError>}
          <Button
            type="submit"
            loading={busy}
            disabled={phase === "done"}
            className="w-full"
          >
            {ctaLabel}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
