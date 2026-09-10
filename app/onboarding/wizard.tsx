"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/Stepper";
import { PropertyCsvImport } from "@/components/PropertyCsvImport";
import { PasswordChecklist } from "@/components/PasswordChecklist";
import { WATER_SOURCE_OPTIONS } from "@/lib/water";
import { isStrongPassword } from "@/lib/password";
import { COMMUNITY_TYPE_OPTIONS } from "@/lib/community";
import { termsFor } from "@/lib/terms";
import { monthlyEstimate } from "@/lib/pricing";
import { peso } from "@/lib/format";
import type { CommunityType } from "@prisma/client";
import { createOrgAndAdmin } from "./actions";

export function OnboardingWizard({ signedIn }: { signedIn: boolean }) {
  const [step, setStep] = useState<1 | 2>(signedIn ? 2 : 1);
  const [communityType, setCommunityType] =
    useState<CommunityType>("SUBDIVISION");

  return (
    <div>
      <div className="mb-8">
        <Stepper steps={["Community details", "Import units"]} current={step} />
      </div>
      {step === 1 ? (
        <Step1
          onDone={(ct) => {
            setCommunityType(ct);
            setStep(2);
          }}
        />
      ) : (
        <Step2 onBack={() => setStep(1)} communityType={communityType} />
      )}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Step 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const PLACEHOLDER: Record<CommunityType, string> = {
  SUBDIVISION: "Sample Subdivision HOA",
  VILLAGE: "Sample Village Homeowners Association",
  TOWNHOUSE: "Sample Townhomes HOA",
  CONDOMINIUM: "Sample Tower Condominium Corp.",
  MIXED: "Sample Community Association",
};

function Step1({ onDone }: { onDone: (ct: CommunityType) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [subdomain, setSubdomain] = useState("");
  const [password, setPassword] = useState("");
  const [unitCount, setUnitCount] = useState("");
  const [communityType, setCommunityType] =
    useState<CommunityType>("SUBDIVISION");
  const t = termsFor(communityType);
  const units = Number(unitCount);
  const estimate =
    Number.isFinite(units) && units >= 1 ? monthlyEstimate(units) : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      communityType,
      orgName: String(fd.get("orgName") ?? ""),
      subdomain: String(fd.get("subdomain") ?? ""),
      estimatedUnits: String(fd.get("estimatedUnits") ?? ""),
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      waterSource: String(fd.get("waterSource") ?? ""),
    };
    setError(null);
    setFieldError(undefined);
    start(async () => {
      const res = await createOrgAndAdmin(input);
      if (res.ok) onDone(communityType);
      else {
        setError(res.error);
        setFieldError(res.field);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-fg">
          Set up your {t.community}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Create your organization and admin account. Takes about a minute —
          starts with a free 30-day trial, no card required.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-fg">
          What kind of community is this?
        </legend>
        {COMMUNITY_TYPE_OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer gap-2.5 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-subtle"
          >
            <input
              type="radio"
              name="communityType"
              value={o.value}
              checked={communityType === o.value}
              onChange={() => setCommunityType(o.value)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-fg">{o.label}</span>
              <span className="block text-xs text-fg-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Field
        label={`${t.orgCap} name`}
        name="orgName"
        placeholder={PLACEHOLDER[communityType]}
        error={fieldError === "orgName" ? error : undefined}
        autoFocus
      />

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

      <div>
        <label className="block text-sm font-medium text-fg">
          About how many {t.units}?
        </label>
        <input
          name="estimatedUnits"
          type="number"
          min={1}
          inputMode="numeric"
          value={unitCount}
          onChange={(e) => setUnitCount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="e.g. 120"
          required
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-brand"
        />
        {estimate ? (
          <p className="mt-1 text-xs text-fg-muted">
            About{" "}
            <span className="font-medium text-fg">
              {peso(estimate.total, { cents: false })}/month
            </span>{" "}
            at {peso(estimate.rate, { cents: false })} per {t.unit} — free for
            your first 30 days.
          </p>
        ) : (
          <p className="mt-1 text-xs text-fg-muted">
            A rough count is fine — it sets your rate band. You&apos;re not
            billed during the trial.
          </p>
        )}
        {fieldError === "estimatedUnits" && (
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
          How does your {t.community} get water?
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

function Step2({
  onBack,
  communityType,
}: {
  onBack: () => void;
  communityType: CommunityType;
}) {
  const router = useRouter();
  const goToDashboard = () => {
    router.push("/dashboard");
    router.refresh();
  };
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-fg">
          Import your {termsFor(communityType).units}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Optional. Upload a CSV now, or skip and add units by hand from the
          dashboard later.
        </p>
      </div>
      {communityType === "CONDOMINIUM" && (
        <p className="rounded-md bg-brand-subtle px-3 py-2 text-xs text-brand-accent">
          For condos, include a <code>floor area</code> column (sqm) — it drives
          both per-sqm dues and floor-area vote weighting. You can also add it
          later per unit.
        </p>
      )}
      <PropertyCsvImport
        onBack={onBack}
        completeLabel="Go to dashboard"
        onComplete={goToDashboard}
        onSkip={goToDashboard}
        skipLabel="Skip for now"
      />
    </div>
  );
}
