import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform";

export const metadata = { title: "Platform console" };

export default async function PlatformConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { admin } = await requirePlatformAdmin();

  return (
    <div className="force-dark min-h-screen bg-bg text-fg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/platform" className="flex items-center gap-2">
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-fg-muted">
              Platform
            </span>
            <span className="text-sm font-semibold text-fg">
              Operator console
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-fg-muted">
            {admin.fullName}
            <form action="/auth/signout" method="post">
              <button className="rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
