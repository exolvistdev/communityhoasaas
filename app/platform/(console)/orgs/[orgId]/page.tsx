import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform";
import { ImpersonateButton } from "./ImpersonateButton";

export default async function PlatformOrgPage({
  params,
}: {
  params: { orgId: string };
}) {
  await requirePlatformAdmin();

  const org = await prisma.organization.findUnique({
    where: { id: params.orgId },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      _count: { select: { properties: true } },
    },
  });
  if (!org) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/platform" className="text-sm text-fg-muted hover:text-fg">
          ← Organizations
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-fg">{org.name}</h1>
        <p className="text-sm text-fg-muted">
          {org.subdomain} · {org.plan} plan · {org._count.properties} properties
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-fg-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {org.users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium text-fg">
                  {u.fullName}
                </td>
                <td className="px-4 py-2.5 text-fg-muted">{u.email}</td>
                <td className="px-4 py-2.5 text-fg-muted">{u.role}</td>
                <td className="px-4 py-2.5">
                  {u.acceptedAt ? (
                    <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-fg">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-fg">
                      Invited
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {u.acceptedAt && (
                    <ImpersonateButton userId={u.id} userName={u.fullName} />
                  )}
                </td>
              </tr>
            ))}
            {org.users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-fg-subtle">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
