import { requirePortalRole } from "@/lib/rbac";

export const metadata = { title: "Gate — pass validation" };

export default async function GuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, user } = await requirePortalRole("GUARD");

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-900">
              {org.name}
            </div>
            <div className="text-xs text-gray-400">
              Gate · {user.fullName}
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
