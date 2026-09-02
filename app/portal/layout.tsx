import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { UserMenu } from "@/components/UserMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { PortalTabBar } from "@/components/PortalTabBar";
import { UnitSwitcher } from "@/components/UnitSwitcher";
import { getNotificationSummary } from "@/lib/notifications";

export const metadata = { title: "Homeowner portal · HOA SaaS" };

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, user, property, homeowners, impersonating } =
    await getHomeownerContext();
  const multiUnit = homeowners.length > 1;

  const unread = await prisma.marketMessage.count({
    where: {
      senderId: { not: user.id },
      readAt: null,
      conversation: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
    },
  });
  const notifications = await getNotificationSummary(user.id);

  return (
    <div className="min-h-screen bg-bg">
      {impersonating && (
        <ImpersonationBanner name={user.fullName} role={user.role} />
      )}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
          <div className="min-w-0">
            <Link href="/portal" className="block min-w-0">
              <div className="truncate text-sm font-semibold text-fg">
                {org.name}
              </div>
            </Link>
            {multiUnit ? (
              <div className="mt-0.5">
                <UnitSwitcher
                  units={homeowners.map((h) => ({
                    propertyId: h.propertyId,
                    unitNumber: h.property.unitNumber,
                  }))}
                  activePropertyId={property?.id ?? null}
                />
              </div>
            ) : (
              <div className="truncate text-xs text-fg-subtle">
                {property ? property.unitNumber : user.fullName}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell
              unread={notifications.unread}
              recent={notifications.recent}
            />
            <UserMenu name={user.fullName} role={user.role} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-5">{children}</main>

      <PortalTabBar unread={unread} />
    </div>
  );
}
