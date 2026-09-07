import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Request a demo · HOA Manager",
  description:
    "Tell us about your association and we'll set up a walkthrough. We reply within one business day.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE;

  return (
    <div className="mx-auto max-w-xl px-5 pb-20 pt-16 sm:pt-20">
      <h1 className="text-3xl font-semibold text-fg sm:text-4xl">
        Request a demo
      </h1>
      <p className="mt-3 text-fg-muted">
        Tell us a bit about your association and we&apos;ll set up a walkthrough
        with your own numbers. We reply within one business day.
      </p>

      <div className="mt-8">
        <ContactForm />
      </div>

      {(email || phone) && (
        <p className="mt-8 border-t border-border pt-6 text-sm text-fg-muted">
          Prefer not to fill in a form?{" "}
          {email && (
            <>
              Email{" "}
              <a
                href={`mailto:${email}`}
                className="text-brand-accent hover:underline"
              >
                {email}
              </a>
            </>
          )}
          {email && phone && " or call "}
          {phone && (
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              className="text-brand-accent hover:underline"
            >
              {phone}
            </a>
          )}
          .
        </p>
      )}
    </div>
  );
}
