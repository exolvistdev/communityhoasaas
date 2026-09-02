"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, FormError } from "@/components/ui/field";
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
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email">
        <Input name="email" type="email" required autoFocus />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" required />
      </Field>
      {error && <FormError>{error}</FormError>}
      <Button type="submit" loading={pending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
