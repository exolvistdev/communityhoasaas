import type { Metadata } from "next";
import type { StaticImageData } from "next/image";
import {
  Building2,
  Wallet,
  ShieldCheck,
  Smartphone,
  CalendarDays,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CtaBand } from "@/components/marketing/CtaBand";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { PhoneFrame } from "@/components/marketing/PhoneFrame";
import ledgerShot from "@/public/marketing/ledger.png";
import portalShot from "@/public/marketing/portal.png";
import gatePassesShot from "@/public/marketing/gate-passes.png";
import portalPayShot from "@/public/marketing/portal-pay.png";
import portalAmenitiesShot from "@/public/marketing/portal-amenities.png";

export const metadata: Metadata = {
  title: "Features · HOA Manager",
  description:
    "Property & billing, a double-entry ledger, the homeowner portal, gate security, GCash/Maya payments, amenity booking, and Marketplace (Beta).",
  alternates: { canonical: "/features" },
};

function Feature({
  icon: Icon,
  title,
  lede,
  points,
  beta = false,
  image,
  imageAlt,
  imageUrl,
  frame,
  reverse = false,
}: {
  icon: LucideIcon;
  title: string;
  lede: string;
  points: string[];
  beta?: boolean;
  /** A real product screenshot to pair with this feature — omit for text-only. */
  image?: StaticImageData;
  imageAlt?: string;
  /** Fake address bar text, for a "browser" frame. */
  imageUrl?: string;
  frame?: "browser" | "phone";
  /** Put the screenshot on the left instead of the right (desktop only). */
  reverse?: boolean;
}) {
  const copy = (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-subtle text-brand-accent">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-semibold text-fg">{title}</h2>
        {beta && <Badge tone="warning">Beta</Badge>}
      </div>
      <p className="mt-3 max-w-2xl text-sm text-fg-muted">{lede}</p>
      <ul className="mt-4 grid gap-2 text-sm text-fg-muted sm:grid-cols-2">
        {points.map((p) => (
          <li
            key={p}
            className="rounded-md border border-border bg-bg px-3 py-2"
          >
            {p}
          </li>
        ))}
      </ul>
    </div>
  );

  if (!image) {
    return (
      <section
        className={
          beta
            ? "rounded-lg border border-dashed border-border bg-surface p-6"
            : ""
        }
      >
        {copy}
      </section>
    );
  }

  const shot =
    frame === "phone" ? (
      <PhoneFrame src={image} alt={imageAlt ?? title} className="max-w-[260px]" />
    ) : (
      <BrowserFrame
        src={image}
        alt={imageAlt ?? title}
        url={imageUrl ?? "sample-hoa.hoasaas.ph"}
      />
    );

  return (
    <section
      className={
        "grid items-center gap-8 lg:grid-cols-2 lg:gap-12" +
        (beta ? " rounded-lg border border-dashed border-border bg-surface p-6" : "")
      }
    >
      <div className={reverse ? "lg:order-2" : undefined}>{copy}</div>
      <div className={reverse ? "lg:order-1" : undefined}>{shot}</div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-5 pb-8 pt-16 sm:pt-20">
        <h1 className="text-3xl font-semibold text-fg sm:text-4xl">
          What&apos;s in HOA Manager
        </h1>
        <p className="mt-3 max-w-2xl text-fg-muted">
          Everything an association needs to bill dues, keep clean books, and run
          the gate — with the specifics of Philippine HOA operations built in.
        </p>
      </section>

      <div className="mx-auto max-w-5xl space-y-14 px-5 pb-16">
        <Feature
          icon={Building2}
          title="Property & billing management"
          lede="Set your units up once, then run dues every month without a spreadsheet."
          points={[
            "Import units, types, and homeowners from a CSV",
            "Dues by property type, per-property override, or a named rate plan",
            "Generate a month's invoices for every unit in one click",
            "Configurable due day; overdue invoices flagged automatically",
            "Opt-in late fees applied by a daily sweep",
            "Every charge and payment posts to a double-entry ledger",
          ]}
          image={ledgerShot}
          imageAlt="The double-entry ledger's trial balance, with real HOA accounts, debits, credits and balances"
          imageUrl="sample-hoa.hoasaas.ph/ledger"
        />

        <Feature
          icon={Wallet}
          title="Homeowner self-service portal"
          lede="Residents stop calling the office to ask what they owe."
          points={[
            "Current balance, next due date, and per-invoice breakdown",
            "Payment history and a printable, exportable statement of account",
            "Submit a payment with its GCash/Maya reference number",
            "Aging summary so residents can see how far behind they are",
            "One login can hold several units",
          ]}
          image={portalShot}
          imageAlt="The homeowner portal home screen, showing an amount due and quick links"
          frame="phone"
          reverse
        />

        <Feature
          icon={ShieldCheck}
          title="Gate security"
          lede="A guard app instead of a paper logbook."
          points={[
            "Guards validate a pass by typing its code or scanning its QR",
            "Single-use visitor passes with a from/until validity window",
            "First scan marks the pass used; a second scan is rejected",
            "Every scan — valid, expired, revoked — written to the visitor log",
            "Homeowners create passes for their own guests from the portal",
          ]}
          image={gatePassesShot}
          imageAlt="The admin gate-pass list, showing visitor names, properties, validity windows and statuses"
          imageUrl="sample-hoa.hoasaas.ph/gate-passes"
        />

        <Feature
          icon={Smartphone}
          title="Philippine payments"
          lede="The payment methods your residents actually use."
          points={[
            "Upload your GCash and Maya receive-money QR and account name",
            "Residents pay in their own app, then submit the reference number",
            "The treasurer confirms or rejects each payment in a reconciliation queue",
            "Cash, check, and bank transfer recorded by staff too",
            "Confirmed payments post to the ledger and update the resident's balance",
          ]}
          image={portalPayShot}
          imageAlt="The portal's Pay Now screen, showing a GCash QR code and a reference-number field"
          frame="phone"
          reverse
        />

        <Feature
          icon={CalendarDays}
          title="Amenity booking"
          lede="Let residents reserve shared spaces without a group chat."
          points={[
            "Bookable amenities — clubhouse, courts, function hall",
            "Time-slot reservations within open hours, with notice and duration limits",
            "Staff approval where you need it; capacity checked on confirm",
            "A fee, when there is one, is invoiced automatically on approval",
            "Cancellations within the cutoff void an unpaid fee",
          ]}
          image={portalAmenitiesShot}
          imageAlt="The portal's Amenities screen, listing the basketball court and clubhouse function hall with their rules and fee"
          frame="phone"
        />

        <Feature
          icon={Store}
          beta
          title="Marketplace"
          lede="Newly launched and still evolving based on community feedback — we're rolling it out carefully, so treat it as a work in progress rather than a finished feature."
          points={[
            "Residents post items for sale within their own HOA",
            "Buyer and seller message each other in-app",
            "Admins moderate listings and reported conversations",
            "Residents can report or block each other",
          ]}
        />
      </div>

      <CtaBand heading="Want a closer look at any of these?" />
    </>
  );
}
