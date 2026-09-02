import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { UserMenu } from "@/components/UserMenu";
import { PortalTabBar } from "@/components/PortalTabBar";

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
      conversation: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
    },
  });

  return (
    <div className="min-h-screen bg-bg">
      {impersonating && (
        <ImpersonationBanner name={user.fullName} role={user.role} />
      )}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
          <Link href="/portal" className="min-w-0">
            <div className="truncate text-sm font-semibold text-fg">
              {org.name}
            </div>
            <div className="truncate text-xs text-fg-subtle">
              {property ? property.unitNumber : user.fullName}
            </div>
          </Link>
          <UserMenu name={user.fullName} role={user.role} />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-5">{children}</main>

      <PortalTabBar unread={unread} />
    </div>
  );
}
