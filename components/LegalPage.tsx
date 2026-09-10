import Link from "next/link";

/** Shared shell for the standalone /privacy and /terms pages — no marketing
 *  chrome, just a centred column, so the two stay visually identical. */
export function LegalPage({
  title,
  updated,
  intro,
  current,
  children,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  /** which page this is, so the footer links the other one */
  current: "privacy" | "terms";
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-bg px-6 py-12 text-fg">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-fg-muted">{intro}</p>
      <p className="mt-1 text-xs text-fg-subtle">Last updated {updated}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-fg-muted">
        {children}
      </div>

      <p className="mt-10 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-subtle">
        <Link href="/" className="hover:underline">
          ← Back
        </Link>
        {current === "privacy" ? (
          <Link href="/terms" className="hover:underline">
            Terms of Use
          </Link>
        ) : (
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        )}
      </p>
    </main>
  );
}

export function LegalSection({
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
