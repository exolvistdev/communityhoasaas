import { ShieldCheck } from "lucide-react";
import { requirePortalRole } from "@/lib/rbac";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { UserMenu } from "@/components/UserMenu";

export const metadata = { title: "Gate — pass validation" };

export default async function GuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, user, impersonating } = await requirePortalRole("GUARD");

  return (
    <div className="min-h-screen bg-bg">
      {impersonating && (
        <ImpersonationBanner name={user.fullName} role={user.role} />
      )}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand bg-gradient-to-br from-brand-hi to-brand text-brand-fg">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-fg">
                {org.name}
              </div>
              <div className="text-xs text-fg-subtle">Gate security</div>
            </div>
          </div>
          <UserMenu name={user.fullName} role={user.role} />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-5 py-8">{children}</main>
    </div>
  );
}
