import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/CtaBand";

export const metadata: Metadata = {
  title: "About · HOA Manager",
  description:
    "Why HOA Manager exists: HOA software built from how Philippine subdivisions actually operate, not adapted from a foreign template.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <article className="mx-auto max-w-2xl px-5 pb-16 pt-16 sm:pt-20">
        <h1 className="text-3xl font-semibold text-fg sm:text-4xl">
          Why this exists
        </h1>

        <div className="mt-8 space-y-4 text-sm leading-relaxed text-fg-muted">
          <p>
            Most HOA software is built for North American associations — monthly
            ACH drafts, no concept of GCash or Maya, prices in dollars.
            Philippine subdivisions run differently: manual payment methods, a
            treasurer reconciling references by hand, a guardhouse with a
            logbook, dues that vary by property type.
          </p>
          <p>
            HOA Manager was built from those specifics rather than adapted from a
            foreign template. Every amount is in pesos. GCash and Maya are
            first-class payment methods, not an afterthought. The Data Privacy
            Act (RA 10173) is handled in the product — a privacy policy, resident
            data export, and a deletion-request workflow — instead of left to the
            board to figure out.
          </p>
          <p>
            Underneath the friendly parts is a real double-entry ledger, so the
            books an association hands to its auditor actually reconcile.
          </p>

          <h2 className="pt-4 text-sm font-semibold text-fg">Who&apos;s behind it</h2>
          <p>
            {/* TODO: replace with the real founder / team line before launch. */}
            HOA Manager is built by a small team based in the Philippines, working
            directly with the associations that use it.
          </p>
        </div>
      </article>

      <CtaBand heading="Want to talk it through?" />
    </>
  );
}
