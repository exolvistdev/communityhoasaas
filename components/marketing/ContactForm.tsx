"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, Input, Textarea, FormError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { submitLead, type ContactResult } from "@/app/(marketing)/contact/actions";

export function ContactForm() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<
    Partial<Record<"name" | "email" | "hoaName", string>>
  >({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    setFormError(null);
    setFieldError({});
    start(async () => {
      const res: ContactResult = await submitLead({
        name,
        email: fd.get("email"),
        hoaName: fd.get("hoaName"),
        phone: fd.get("phone"),
        message: fd.get("message"),
        company: fd.get("company"),
      });
      if (res.ok) {
        setDone(name.trim().split(/\s+/)[0] || "there");
        return;
      }
      if (res.field) setFieldError({ [res.field]: res.error });
      else setFormError(res.error);
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle text-success-fg">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <h2 className="mt-3 text-lg font-semibold text-fg">
          Thanks, {done}.
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          We&apos;ve got your request and will be in touch within one business
          day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Name" error={fieldError.name}>
        <Input name="name" required autoComplete="name" />
      </Field>
      <Field label="Email" error={fieldError.email}>
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="HOA or community name" error={fieldError.hoaName}>
        <Input name="hoaName" required autoComplete="organization" />
      </Field>
      <Field label="Phone" hint="Optional">
        <Input name="phone" type="tel" autoComplete="tel" />
      </Field>
      <Field label="Anything we should know?" hint="Optional">
        <Textarea name="message" rows={4} maxLength={2000} />
      </Field>

      {/* Honeypot */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <FormError>{formError}</FormError>

      <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
        {pending ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}
