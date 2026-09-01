import { requirePortalRole } from "@/lib/rbac";

export const metadata = { title: "Homeowner portal · HOA SaaS" };

export default async function PortalHome() {
  const { org, user } = await requirePortalRole("HOMEOWNER");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <div className="text-xs uppercase tracking-wide text-gray-400">
        {org.name}
      </div>
      <h1 className="mt-1 text-xl font-semibold text-gray-900">
        Homeowner portal
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Hi {user.fullName.split(" ")[0]} — your balance, payment history, and
        Pay&nbsp;Now (Wireframe Brief §4.4) are coming in the next release.
      </p>
      <form action="/auth/signout" method="post" className="mt-6">
        <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
          Sign out
        </button>
      </form>
    </main>
  );
}
