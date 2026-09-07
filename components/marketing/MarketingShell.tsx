import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { MarketingHeader } from "./MarketingHeader";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <MarketingHeader />
      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Wordmark label="HOA Manager" />
            <p className="max-w-xs text-sm text-fg-muted">
              HOA management built for Philippine subdivisions — peso billing,
              GCash and Maya, an auditable ledger.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-fg-muted hover:text-fg"
              >
                {n.label}
              </Link>
            ))}
            <Link href="/privacy" className="text-fg-muted hover:text-fg">
              Privacy
            </Link>
            <Link href="/login" className="text-fg-muted hover:text-fg">
              Sign in
            </Link>
          </nav>
        </div>
        <div className="border-t border-border">
          <p className="mx-auto max-w-5xl px-5 py-4 text-xs text-fg-subtle">
            © {new Date().getFullYear()} HOA Manager · Built for the Philippines
          </p>
        </div>
      </footer>
    </div>
  );
}
