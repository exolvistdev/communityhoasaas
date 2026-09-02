import { requireStaff } from "@/lib/rbac";
import { Sidebar } from "@/components/Sidebar";
import { UserMenu } from "@/components/UserMenu";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, user, impersonating } = await requireStaff();

  return (
    <div className="flex min-h-screen flex-col">
      {impersonating && (
        <ImpersonationBanner name={user.fullName} role={user.role} />
      )}
      <div className="flex flex-1">
        <Sidebar orgName={org.name} role={user.role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 hidden h-14 items-center justify-end border-b border-border bg-surface/80 px-6 backdrop-blur lg:flex">
            <UserMenu name={user.fullName} role={user.role} />
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
