"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, FormError } from "@/components/ui/field";
import { signIn } from "./actions";

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
      <Field label="Email">
        <Input name="email" type="email" required autoFocus />
      </Field>
      <Field
        label={
          <span className="flex items-center justify-between">
            Password
            <Link
              href="/forgot-password"
              className="text-xs font-normal text-brand-accent hover:underline"
            >
              Forgot?
            </Link>
          </span>
        }
      >
        <Input name="password" type="password" required />
      </Field>

      {error && <FormError>{error}</FormError>}

      <Button type="submit" loading={pending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
