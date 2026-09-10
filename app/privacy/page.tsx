import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { AnalyticsPreference } from "@/components/AnalyticsPreference";

export const metadata = { title: "Privacy Policy · HOA SaaS" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 2026"
      current="privacy"
      intro={
        <>
          How your homeowners&apos; association or condominium corporation
          handles your personal data, under the Philippine Data Privacy Act of
          2012 (Republic Act No. 10173).
        </>
      }
    >
      <LegalSection title="Who controls your data">
        <p>
          Your homeowners&apos; association or condominium corporation is the
          personal information controller for the data described here. This
          platform (HOA Manager, operated by Exolvist) is the
          association&apos;s processor and stores the data on its behalf.
        </p>
        <p>
          For visitors to our public website and people who contact us before
          signing up, Exolvist is the controller of the limited data described
          in &ldquo;Visitors and enquiries&rdquo; below.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Your name, contact email and phone number, and the unit(s) you own
            or rent. For condominiums, the building, floor and floor area of
            your unit.
          </li>
          <li>Your login email, role, and notification settings.</li>
          <li>
            Billing records — invoices, payments, references, balances, carried
            credit, refunds, and fine notices.
          </li>
          <li>
            Gate passes you create and the visitor names on them, and the
            gate-scan log.
          </li>
          <li>
            Maintenance requests and their photos; recorded violations, fine
            notices and their photos.
          </li>
          <li>
            Board-meeting attendance, resolution votes, voting proxies, and
            election ballots.
          </li>
          <li>
            Water-meter readings for your unit, where the association
            sub-meters water.
          </li>
          <li>
            Marketplace listings, messages, reports and blocks; amenity
            bookings; and in-app notifications.
          </li>
          <li>
            Documents the association uploads (by-laws, minutes, financial
            statements) — some of these name individuals.
          </li>
          <li>Records of a unit changing hands or being vacated.</li>
          <li>An audit log of actions taken in the system.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Visitors and enquiries">
        <p>
          If you send us a message through the website contact form, we keep
          your name, email, phone number and message so we can respond and
          follow up.
        </p>
        <p>
          We briefly log the IP address of requests to sign in, sign up, reset a
          password, submit the contact form, or open a gate-pass link. These
          logs exist only to rate-limit abuse and protect the service, and are
          deleted within about a day.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and similar technologies">
        <p>
          Once you sign in, the app sets a few{" "}
          <strong className="font-medium text-fg">strictly-necessary</strong>{" "}
          cookies — a login session, an operator support token (only for
          platform staff), and a remembered active-unit preference. These are
          not set when you only browse the public website.
        </p>
        <p>
          On the public website we use{" "}
          <strong className="font-medium text-fg">Vercel Web Analytics</strong> to
          count page views in aggregate — without cookies, without cross-site
          tracking, and without building a profile of you. It identifies a visit
          with a short-lived, one-way hash and stores nothing on your device.
        </p>
        <p>
          Separately, we store your{" "}
          <strong className="font-medium text-fg">analytics choice</strong> — and
          whether you have dismissed the notice about it — in your browser, so we
          can respect that choice and not repeat the notice on every page. You
          can turn visit analytics on or off at any time.
        </p>
        <AnalyticsPreference />
      </LegalSection>

      <LegalSection title="Why we use it">
        <p>
          To run the association: bill and collect dues, keep financial records,
          manage gate security and amenities, run the resident marketplace,
          conduct board meetings and elections, communicate with members, and
          protect the service against abuse. We do not sell your data or use it
          for advertising.
        </p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>
          Association staff and board members, on a need-to-know basis. The
          platform uses Supabase for database and file hosting and Postmark for
          sending email. We disclose data to authorities only when legally
          required.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          Financial records (dues, payments, ledger entries) are retained for at
          least ten years as required by Philippine tax and audit rules. Other
          personal data is kept while you are a member and for a reasonable
          period afterward, then deleted or anonymised. Security and IP logs are
          kept for about a day; contact-form enquiries are kept until handled
          and for a reasonable period afterward.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You may access, correct, object to the processing of, and request
          erasure of your personal data, and obtain a copy of it in a portable
          format. You may also lodge a complaint with the National Privacy
          Commission (
          <a
            href="https://privacy.gov.ph"
            className="text-brand-accent hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            privacy.gov.ph
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection title="Exercising your rights">
        <p>
          Signed-in members can download a machine-readable copy of their data
          and request account deletion from{" "}
          <Link href="/account" className="text-brand-accent hover:underline">
            their account page
          </Link>
          . Financial records are retained as noted above. For objections to
          processing, or corrections beyond your profile, contact your
          association&apos;s office or its Data Protection Officer.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
