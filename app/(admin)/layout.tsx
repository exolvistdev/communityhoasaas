import Link from "next/link";
import { requireStaff } from "@/lib/rbac";
import { Sidebar } from "@/components/Sidebar";
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
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center justify-end border-b border-gray-200 bg-white px-6 text-sm text-gray-500">
            <Link href="/account" className="hover:text-gray-900">
              {user.fullName} · {user.role.toLowerCase().replace("_", " ")}
            </Link>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
