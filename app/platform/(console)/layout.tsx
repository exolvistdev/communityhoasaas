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
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/platform" className="flex items-center gap-2">
            <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-medium tracking-wide text-gray-300">
              PLATFORM
            </span>
            <span className="text-sm font-medium text-white">
              Operator console
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            {admin.fullName}
            <form action="/auth/signout" method="post">
              <button className="rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white">
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
