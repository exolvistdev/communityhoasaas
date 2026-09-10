import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const metadata = { title: "Terms of Use · HOA SaaS" };

// TODO: confirm the legal entity name, registered address and venue with
// counsel before launch — "Exolvist" and the venue below are placeholders,
// consistent with the founder-line TODO on /about.

export default function TermsOfUsePage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="September 2026"
      current="terms"
      intro={
        <>
          The rules for using HOA Manager. By using the service you agree to
          these terms.
        </>
      }
    >
      <LegalSection title="About these terms">
        <p>
          HOA Manager is operated by Exolvist (&ldquo;the operator&rdquo;,
          &ldquo;we&rdquo;). Your homeowners&apos; association or condominium
          corporation is the customer; residents, staff and guards use the
          service under that association&apos;s account. These terms are between
          you and the operator. Your association&apos;s own by-laws and house
          rules also apply to how you use it.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          Keep your login credentials secure. You are responsible for everything
          done under your account. Each login is for one person — don&apos;t
          share it. Tell your association or the operator promptly if you think
          someone else has used your account.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>use the service for anything unlawful;</li>
          <li>
            upload malware, or probe, scan, overload or attack the service or its
            infrastructure;
          </li>
          <li>
            impersonate another person, or harass, threaten or defame other
            residents through the marketplace or messaging;
          </li>
          <li>post content you don&apos;t have the right to share;</li>
          <li>
            circumvent access controls, rate limits, or the separation between
            associations; or
          </li>
          <li>use the service to send spam or bulk unsolicited messages.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Content you submit">
        <p>
          You keep ownership of what you post — listings, messages, photos,
          notes and similar. You grant the operator and your association a
          non-exclusive licence to store, display and process that content as
          needed to run the service. You are responsible for having the right to
          post what you post. We may remove content that breaks these terms or
          the law.
        </p>
      </LegalSection>

      <LegalSection title="Your association runs its community">
        <p>
          Dues amounts, fines, gate policy, board decisions, elections and
          similar are set and administered by your association, not the
          operator. The operator provides the software that records and carries
          them out. Disputes about those decisions should go to your
          association.
        </p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          The service is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis. We aim for high availability but do not
          guarantee uninterrupted or error-free service, and we may change,
          add or remove features. We will give paying customers notice of
          material changes.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers and liability">
        <p>
          To the fullest extent Philippine law allows, the operator makes no
          warranties, express or implied. The service is a record-keeping tool —
          it is not legal, tax, accounting or financial advice. The
          operator&apos;s total liability arising from the service is limited to
          the fees paid for it in the twelve months before the claim (and is
          zero where no fees have been paid). Nothing in these terms excludes
          liability that cannot be excluded under Philippine law.
        </p>
      </LegalSection>

      <LegalSection title="Privacy">
        <p>
          Your use of the service is also governed by the{" "}
          <Link href="/privacy" className="text-brand-accent hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Suspension and termination">
        <p>
          Your association can remove your access at any time. You may stop
          using the service at any time. The operator may suspend or terminate
          an account that breaks these terms.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These terms are governed by the laws of the Republic of the
          Philippines. Any dispute will be brought in the courts of{" "}
          <span className="text-fg-subtle">[city — to be confirmed]</span>.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. Continued use of the service after an
          update means you accept the revised terms. The &ldquo;last
          updated&rdquo; date at the top reflects the current version.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms? Reach us through your association, or via{" "}
          <Link href="/contact" className="text-brand-accent hover:underline">
            our contact page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
