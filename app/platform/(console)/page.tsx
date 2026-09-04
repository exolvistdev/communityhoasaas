import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform";
import { OrgStatusBadge } from "./OrgStatusBadge";

export default async function PlatformDirectoryPage() {
  await requirePlatformAdmin();

  const [orgs, recentImpersonations] = await Promise.all([
    prisma.organization.findMany({
      include: { _count: { select: { properties: true, users: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.impersonationEvent.findMany({
      include: {
        platformAdmin: { select: { fullName: true } },
        targetUser: { select: { fullName: true, role: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 15,
    }),
  ]);

  const fmt = (d: Date) =>
    d.toLocaleString("en-PH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-fg">Organizations</h1>
        <p className="text-sm text-fg-muted">
          Every HOA on the platform. {orgs.length} total.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-fg-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Subdomain</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Properties</th>
              <th className="px-4 py-2.5 text-right font-medium">Users</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-t border-border">
                <td className="px-4 py-2.5 font-medium text-fg">
                  <Link href={`/platform/orgs/${org.id}`} className="hover:underline">
                    {org.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-fg-muted">{org.subdomain}</td>
                <td className="px-4 py-2.5 text-fg-muted">{org.plan}</td>
                <td className="px-4 py-2.5">
                  <OrgStatusBadge org={org} />
                </td>
                <td className="px-4 py-2.5 text-right text-fg-muted">
                  {org._count.properties}
                </td>
                <td className="px-4 py-2.5 text-right text-fg-muted">
                  {org._count.users}
                </td>
                <td className="px-4 py-2.5 text-fg-muted">
                  {fmt(org.createdAt)}
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-fg-subtle">
                  No organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-fg">
          Recent impersonations
        </h2>
        {recentImpersonations.length === 0 ? (
          <p className="text-sm text-fg-subtle">None yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {recentImpersonations.map((e) => (
                  <tr key={e.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2 text-fg-muted">
                      {e.platformAdmin.fullName}
                    </td>
                    <td className="px-4 py-2 text-fg-muted">as</td>
                    <td className="px-4 py-2 text-fg">
                      {e.targetUser.fullName} ({e.targetUser.role})
                    </td>
                    <td className="px-4 py-2 text-fg-subtle">{e.targetOrgName}</td>
                    <td className="px-4 py-2 text-fg-subtle">
                      {fmt(e.startedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {e.endedAt ? (
                        <span className="text-xs text-fg-subtle">ended</span>
                      ) : (
                        <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-fg">
                          ongoing
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
