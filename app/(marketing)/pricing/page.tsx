import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { CtaBand } from "@/components/marketing/CtaBand";
import { PRICING_BANDS, bandRangeLabel } from "@/lib/pricing";

const BANDS = PRICING_BANDS.map((b) => ({
  rate: `₱${b.rate}`,
  unit: "/ property / month",
  range: bandRangeLabel(b),
}));

export const metadata: Metadata = {
  title: "Pricing · HOA Manager",
  description: `One rate per property, per month: ${PRICING_BANDS.map(
    (b) => `₱${b.rate} for ${bandRangeLabel(b, "")}`
  ).join(", ")} properties. Every feature at every tier.`,
  alternates: { canonical: "/pricing" },
};

const INCLUDED = [
  "Billing & double-entry accounting",
  "Homeowner self-service portal",
  "Gate security & visitor passes",
  "Amenity booking",
  "GCash / Maya, cash, check, bank transfer",
  "Data Privacy Act tools (policy, export, deletion workflow)",
  "Unlimited admin, staff, and homeowner accounts",
];

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-5 pb-8 pt-16 sm:pt-20">
        <h1 className="text-3xl font-semibold text-fg sm:text-4xl">
          Simple per-property pricing
        </h1>
        <p className="mt-3 max-w-2xl text-fg-muted">
          One rate per property, per month. It&apos;s set by your active property
          count and moves to the next band as your community grows — there&apos;s
          nothing to upgrade.
        </p>
      </section>

      {/* Bands */}
      <section className="mx-auto max-w-5xl px-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {BANDS.map((b) => (
            <div
              key={b.range}
              className="rounded-lg border border-border bg-surface p-6"
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold text-fg">{b.rate}</span>
                <span className="text-sm text-fg-subtle">{b.unit}</span>
              </div>
              <p className="mt-1 text-sm text-fg-muted">{b.range}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What's included */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <h2 className="text-2xl font-semibold text-fg">
          Every plan includes everything
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-fg-muted">
          There are no feature gates between bands. The only thing that changes
          with size is the per-property rate.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {INCLUDED.map((i) => (
            <li key={i} className="flex gap-2.5 text-sm text-fg">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
              <span>{i}</span>
            </li>
          ))}
          <li className="flex items-center gap-2.5 text-sm text-fg">
            <Check className="h-4 w-4 shrink-0 text-brand-accent" />
            <span>Marketplace</span>
            <Badge tone="warning">Beta</Badge>
          </li>
        </ul>
      </section>

      {/* Branded email */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <h2 className="text-2xl font-semibold text-fg">
            Branded email, included free
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-fg-muted">
            A mailbox on your HOA&apos;s own domain — for example{" "}
            <span className="font-medium text-fg">admin@yourhoa.ph</span> — is
            included at every tier, so notices to homeowners come from your
            association, not a generic address.
          </p>
        </div>
      </section>

      {/* Quote CTA */}
      <section className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-20">
        <h2 className="text-2xl font-semibold text-fg">
          Not sure which band you land in?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-fg-muted">
          Tell us your property count and we&apos;ll send back your exact monthly
          figure.
        </p>
        <Link
          href="/contact"
          className={buttonClass({
            size: "lg",
            className: "mt-6 w-full sm:w-auto",
          })}
        >
          Get a quote
        </Link>
      </section>

      <CtaBand heading="Ready to see it on your own numbers?" label="Get a quote" />
    </>
  );
}
