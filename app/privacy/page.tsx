import Link from "next/link";

export const metadata = { title: "Privacy Policy · HOA SaaS" };

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-bg px-6 py-12 text-fg">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-fg-muted">
        How your homeowners&apos; association handles your personal data, under
        the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-fg-muted">
        <Section title="Who controls your data">
          <p>
            Your homeowners&apos; association is the personal information
            controller for the data described here. This platform is the
            association&apos;s processor and stores the data on its behalf.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Your name, contact email and phone number, and the unit(s) you own
              or rent.
            </li>
            <li>
              Your login email and account settings.
            </li>
            <li>
              Billing records — invoices, payments, references and balances.
            </li>
            <li>
              Gate passes you create and the visitor names on them.
            </li>
            <li>
              Marketplace listings, messages and reports; amenity bookings; and
              in-app notifications.
            </li>
            <li>
              An audit log of actions taken in the system.
            </li>
          </ul>
        </Section>

        <Section title="Why we use it">
          <p>
            To run the association: bill and collect dues, keep financial
            records, manage gate security and amenities, run the resident
            marketplace, and communicate with members. We do not sell your data
            or use it for advertising.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>
            Association staff and board members, on a need-to-know basis. The
            platform uses Supabase for database and file hosting and Resend for
            sending email. We disclose data to authorities only when legally
            required.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Financial records (dues, payments, ledger entries) are retained for
            at least ten years as required by Philippine tax and audit rules.
            Other personal data is kept while you are a member and for a
            reasonable period afterward, then deleted or anonymised.
          </p>
        </Section>

        <Section title="Your rights">
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
        </Section>

        <Section title="Exercising your rights">
          <p>
            Signed-in members can download a full copy of their data and request
            account deletion from{" "}
            <Link href="/account" className="text-brand-accent hover:underline">
              their account page
            </Link>
            . For anything else, contact your association&apos;s office or its
            Data Protection Officer.
          </p>
        </Section>
      </div>

      <p className="mt-10 text-xs text-fg-subtle">
        <Link href="/" className="hover:underline">
          ← Back
        </Link>
      </p>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <div className="mt-1.5 space-y-2">{children}</div>
    </section>
  );
}
