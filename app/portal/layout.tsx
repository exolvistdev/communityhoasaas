import Link from "next/link";
import { getHomeownerContext } from "@/lib/portal";

export const metadata = { title: "Homeowner portal · HOA SaaS" };

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, user, property } = await getHomeownerContext();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link href="/portal" className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-900">
              {org.name}
            </div>
            <div className="truncate text-xs text-gray-400">
              {property ? property.unitNumber : user.fullName}
            </div>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-5">{children}</main>
    </div>
  );
}
