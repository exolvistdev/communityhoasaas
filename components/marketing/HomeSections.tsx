import Link from "next/link";
import {
  Building2,
  Wallet,
  ShieldCheck,
  Smartphone,
  CalendarDays,
  Check,
} from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { CtaBand } from "./CtaBand";

const PROBLEMS = [
  "Dues tracked in a spreadsheet only the treasurer really understands.",
  "GCash and Maya payments reconciled by hand against a bank statement.",
  "Homeowners calling the office just to ask what they owe.",
  "A paper logbook at the gate, with no way to check whether a pass is real.",
];

const PILLARS = [
  {
    icon: Building2,
    title: "Property & billing",
    body: "Import your unit list, set dues by property type, and generate a month's invoices for every unit in one click — each posted to a real double-entry ledger.",
  },
  {
    icon: Wallet,
    title: "Homeowner portal",
    body: "Residents sign in to see their balance, due dates, and payment history, and submit a payment with its reference number for the treasurer to confirm.",
  },
  {
    icon: ShieldCheck,
    title: "Gate security",
    body: "Guards validate visitor passes by code or QR. Passes are single-use with a validity window, and every scan is written to the visitor log.",
  },
  {
    icon: Smartphone,
    title: "Philippine payments",
    body: "Show your GCash and Maya QR; residents pay in their own app and submit the reference. Cash, check, and bank transfer are supported too.",
  },
  {
    icon: CalendarDays,
    title: "Amenity booking",
    body: "Residents book the clubhouse, courts, or function hall in time slots, with staff approval where you need it and the fee invoiced automatically.",
  },
];

const STEPS = [
  { n: "1", label: "Sign up", body: "Create your HOA and add your team." },
  {
    n: "2",
    label: "Import properties",
    body: "Upload your unit list from a CSV — units, types, and homeowners.",
  },
  {
    n: "3",
    label: "Generate invoices",
    body: "Run this month's dues for every unit at its configured rate.",
  },
  {
    n: "4",
    label: "Everyone's in sync",
    body: "Homeowners pay from the portal; the board sees every peso in one place.",
  },
];

export function HomeSections() {
  return (
    <>
      {/* Hero */}
      <section className="bg-brand bg-gradient-to-br from-brand-hi to-brand text-brand-fg">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
          <h1 className="font-display max-w-3xl text-3xl font-semibold leading-tight sm:text-5xl">
            HOA and condo management, built for the Philippines.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-brand-fg/80 sm:text-lg">
            Dues billing, an auditable ledger, a resident portal, and gate
            security in one system — for subdivisions, villages and
            condominiums, and it speaks GCash, Maya, and pesos.
          </p>
          <div className="mt-8">
            <Link
              href="/contact"
              className={buttonClass({
                variant: "secondary",
                size: "lg",
                className: "w-full sm:w-auto",
              })}
            >
              Request a demo
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <h2 className="text-2xl font-semibold text-fg">
          Running an HOA on spreadsheets and a logbook is a full-time job.
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {PROBLEMS.map((p) => (
            <li
              key={p}
              className="rounded-lg border border-border bg-surface p-4 text-sm text-fg-muted"
            >
              {p}
            </li>
          ))}
        </ul>
      </section>

      {/* Solution — 5 pillars */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <h2 className="text-2xl font-semibold text-fg">
            One system for the whole association.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            Five things every community needs, working together instead of in
            five separate spreadsheets.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-border bg-bg p-5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-subtle text-brand-accent">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-semibold text-fg">{f.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm">
            <Link
              href="/features"
              className="text-brand-accent hover:underline"
            >
              See each feature in detail →
            </Link>
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
        <h2 className="text-2xl font-semibold text-fg">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-fg">
                {s.n}
              </span>
              <h3 className="mt-3 font-semibold text-fg">{s.label}</h3>
              <p className="mt-1 text-sm text-fg-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Built for the Philippines */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
          <h2 className="text-2xl font-semibold text-fg">
            Built for the Philippines, not adapted to it.
          </h2>
          <ul className="mt-6 space-y-3 text-sm text-fg-muted">
            {[
              "Peso billing end to end — every amount, invoice, and statement in PHP.",
              "GCash and Maya as first-class payment methods, plus cash, check, and bank transfer.",
              "A built-in privacy policy, resident data export, and a deletion-request workflow aligned with the Data Privacy Act (RA 10173).",
            ].map((line) => (
              <li key={line} className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand heading="See it with your own community's numbers." />
    </>
  );
}
