import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

export const metadata = { title: "Homeowner portal · HOA SaaS" };

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, user, property, impersonating } = await getHomeownerContext();

  const unread = await prisma.marketMessage.count({
    where: {
      senderId: { not: user.id },
      readAt: null,
      conversation: {
        OR: [{ buyerId: user.id }, { sellerId: user.id }],
      },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {impersonating && (
        <ImpersonationBanner name={user.fullName} role={user.role} />
      )}
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
          <div className="flex items-center gap-3">
            <Link
              href="/account"
              className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            >
              Account
            </Link>
            <form action="/auth/signout" method="post">
              <button className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-md gap-4 px-4 pb-2 text-xs">
          <Link href="/portal" className="text-gray-500 hover:text-gray-900">
            Home
          </Link>
          <Link
            href="/portal/amenities"
            className="text-gray-500 hover:text-gray-900"
          >
            Amenities
          </Link>
          <Link
            href="/portal/market"
            className="text-gray-500 hover:text-gray-900"
          >
            Marketplace
          </Link>
          <Link
            href="/portal/messages"
            className="flex items-center gap-1 text-gray-500 hover:text-gray-900"
          >
            Messages
            {unread > 0 && (
              <span className="rounded-full bg-gray-900 px-1.5 text-[10px] font-medium text-white">
                {unread}
              </span>
            )}
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-md px-4 py-5">{children}</main>
    </div>
  );
}
