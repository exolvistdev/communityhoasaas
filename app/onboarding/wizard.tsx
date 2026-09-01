"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/Stepper";
import { PropertyCsvImport } from "@/components/PropertyCsvImport";
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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      orgName: String(fd.get("orgName") ?? ""),
      subdomain: String(fd.get("subdomain") ?? ""),
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
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
        <h1 className="text-xl font-semibold text-gray-900">Set up your HOA</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create your organization and admin account. Takes about a minute.
        </p>
      </div>

      <Field label="HOA name" name="orgName" placeholder="Sample Subdivision HOA" error={fieldError === "orgName" ? error : undefined} autoFocus />

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Subdomain
        </label>
        <div className="mt-1 flex rounded-md border border-gray-300 focus-within:border-gray-900">
          <input
            name="subdomain"
            value={subdomain}
            onChange={(e) =>
              setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
            }
            placeholder="sample-hoa"
            className="w-full rounded-l-md px-3 py-2 text-sm outline-none"
            required
          />
          <span className="flex items-center rounded-r-md bg-gray-50 px-3 text-sm text-gray-400">
            .hoasaas.ph
          </span>
        </div>
        {fieldError === "subdomain" && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
      </div>

      <hr className="border-gray-200" />

      <Field label="Your full name" name="fullName" placeholder="Maria Santos" error={fieldError === "fullName" ? error : undefined} />
      <Field label="Email" name="email" type="email" placeholder="you@example.com" error={fieldError === "email" ? error : undefined} />
      <Field label="Password" name="password" type="password" placeholder="At least 8 characters" error={fieldError === "password" ? error : undefined} />

      {error && !fieldError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Setting upâ€¦" : "Continue"}
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
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Step 2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function Step2({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Import your property roll
        </h1>
        <p className="mt-1 text-sm text-gray-500">
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
