import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationList } from "./NotificationList";

export const metadata = { title: "Notifications · HOA SaaS" };

const HOME_HREF: Record<string, string> = {
  ADMIN: "/dashboard",
  TREASURER: "/dashboard",
  BOARD_MEMBER: "/dashboard",
  GUARD: "/guard",
  HOMEOWNER: "/portal",
};

export default async function NotificationsPage() {
  const { user } = await getCurrentOrgContext();

  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-xl space-y-6 px-6 py-8">
      <div>
        <Link
          href={HOME_HREF[user.role] ?? "/"}
          className="text-sm text-fg-muted hover:text-fg"
        >
          ← Back
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-fg">Notifications</h1>
        <p className="text-sm text-fg-muted">
          Manage what lands here in{" "}
          <Link href="/account" className="text-brand-accent hover:underline">
            account settings
          </Link>
          .
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing yet"
          description="Billing updates, announcements, and booking decisions will show up here."
        />
      ) : (
        <NotificationList
          items={rows.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            href: n.href,
            readAt: n.readAt ? n.readAt.toISOString() : null,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      )}
    </main>
  );
}
