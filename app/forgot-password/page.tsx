"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export default function ForgotPasswordPage() {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    start(async () => {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
    });
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={
        <Link href="/login" className="text-brand-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="rounded-lg bg-success-subtle px-3 py-2.5 text-sm text-success-fg">
          If that email has an account, a reset link is on its way. Ask your
          admin for help if it doesn&apos;t arrive.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <Input name="email" type="email" required autoFocus />
          </Field>
          <Button type="submit" loading={pending} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
