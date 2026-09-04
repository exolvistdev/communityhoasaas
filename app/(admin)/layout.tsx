import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { Sidebar } from "@/components/Sidebar";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { getNotificationSummary } from "@/lib/notifications";
import { waterMetered } from "@/lib/water";
import { trialDaysLeft } from "@/lib/trial";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, user, impersonating } = await requireStaff();
  const [notifications, homeownerLinks] = await Promise.all([
    getNotificationSummary(user.id),
    prisma.homeowner.count({ where: { userId: user.id } }),
  ]);
  const daysLeft = trialDaysLeft(org);

  return (
    <div className="flex min-h-screen flex-col">
      {impersonating && (
        <ImpersonationBanner name={user.fullName} role={user.role} />
      )}
      {daysLeft !== null && daysLeft <= 7 && (
        <TrialBanner daysLeft={daysLeft} orgName={org.name} />
      )}
      <div className="flex flex-1">
        <Sidebar
          orgName={org.name}
          role={user.role}
          features={{ water: waterMetered(org.waterSource) }}
          userName={user.fullName}
          residentHref={homeownerLinks > 0 ? "/portal" : undefined}
          notifications={notifications}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
