"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/Stepper";
import { PropertyCsvImport } from "@/components/PropertyCsvImport";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { WATER_SOURCE_OPTIONS } from "@/lib/water";
import { isStrongPassword } from "@/lib/password";
import { createOrgAndAdmin } from "./actions";

export function OnboardingWizard({ signedIn }: { signedIn: boolean }) {
  const [step, setStep] = useState<1 | 2>(signedIn ? 2 : 1);

  return (
    <div>
      <div className="mb-8">
        <Stepper steps={["HOA details", "Import properties"]} current={step} />
      </div>
      {step === 1 ? (
        <Step1 onDone={() => setStep(2)} />
      ) : (
        <Step2 onBack={() => setStep(1)} />
      )}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Step 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function Step1({ onDone }: { onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [subdomain, setSubdomain] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      orgName: String(fd.get("orgName") ?? ""),
      subdomain: String(fd.get("subdomain") ?? ""),
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      waterSource: String(fd.get("waterSource") ?? ""),
    };
    setError(null);
    setFieldError(undefined);
    start(async () => {
      const res = await createOrgAndAdmin(input);
      if (res.ok) onDone();
      else {
        setError(res.error);
        setFieldError(res.field);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-fg">Set up your HOA</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Create your organization and admin account. Takes about a minute —
          starts with a free 30-day trial, no card required.
        </p>
      </div>

      <Field label="HOA name" name="orgName" placeholder="Sample Subdivision HOA" error={fieldError === "orgName" ? error : undefined} autoFocus />

      <div>
        <label className="block text-sm font-medium text-fg">
          Subdomain
        </label>
        <div className="mt-1 flex rounded-md border border-border focus-within:border-gray-900">
          <input
            name="subdomain"
            value={subdomain}
            onChange={(e) =>
              setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            placeholder="sample-hoa"
            className="w-full min-w-0 rounded-l-md px-3 py-2 text-sm outline-none"
            required
          />
          <span className="flex shrink-0 items-center rounded-r-md bg-surface-2 px-3 text-sm text-fg-subtle">
            .hoasaas.ph
          </span>
        </div>
        {fieldError === "subdomain" && (
          <p className="mt-1 text-xs text-danger-fg">{error}</p>
        )}
      </div>

      <hr className="border-border" />

      <Field label="Your full name" name="fullName" placeholder="Maria Santos" error={fieldError === "fullName" ? error : undefined} />
      <Field label="Email" name="email" type="email" placeholder="you@example.com" error={fieldError === "email" ? error : undefined} />

      <div>
        <label className="block text-sm font-medium text-fg">Password</label>
        <input
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 10 characters"
          required
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <PasswordChecklist password={password} />
        {fieldError === "password" && (
          <p className="mt-1 text-xs text-danger-fg">{error}</p>
        )}
      </div>

      <hr className="border-border" />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-fg">
          How does your subdivision get water?
        </legend>
        <p className="text-xs text-fg-muted">
          This sets up (or hides) water sub-metering. You can change it later in
          Settings.
        </p>
        {WATER_SOURCE_OPTIONS.map((o, i) => (
          <label
            key={o.value}
            className="flex cursor-pointer gap-2.5 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
          >
            <input
              type="radio"
              name="waterSource"
              value={o.value}
              defaultChecked={i === 0}
              className="mt-0.5"
              required
            />
            <span>
              <span className="font-medium text-fg">{o.label}</span>
              <span className="block text-xs text-fg-muted">{o.hint}</span>
            </span>
          </label>
        ))}
        {fieldError === "waterSource" && (
          <p className="text-xs text-danger-fg">{error}</p>
        )}
      </fieldset>

      {error && !fieldError && (
        <p className="rounded-md bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !isStrongPassword(password)}
        className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Setting up…" : "Continue"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  error,
  autoFocus,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  error?: string | null;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-fg">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required
        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand"
      />
      {error && <p className="mt-1 text-xs text-danger-fg">{error}</p>}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Step 2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function Step2({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-fg">
          Import your property roll
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          You can also add properties by hand later.
        </p>
      </div>
      <PropertyCsvImport
        onBack={onBack}
        completeLabel="Go to dashboard"
        onComplete={() => {
          router.push("/dashboard");
          router.refresh();
        }}
      />
    </div>
  );
}
