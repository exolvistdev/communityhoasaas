import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform";

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
        <h1 className="text-lg font-semibold text-white">Organizations</h1>
        <p className="text-sm text-gray-400">
          Every HOA on the platform. {orgs.length} total.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 text-left text-gray-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Subdomain</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 text-right font-medium">Properties</th>
              <th className="px-4 py-2.5 text-right font-medium">Users</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-t border-gray-800">
                <td className="px-4 py-2.5 font-medium text-white">
                  <Link href={`/platform/orgs/${org.id}`} className="hover:underline">
                    {org.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-400">{org.subdomain}</td>
                <td className="px-4 py-2.5 text-gray-400">{org.plan}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">
                  {org._count.properties}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-300">
                  {org._count.users}
                </td>
                <td className="px-4 py-2.5 text-gray-400">
                  {fmt(org.createdAt)}
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No organizations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-white">
          Recent impersonations
        </h2>
        {recentImpersonations.length === 0 ? (
          <p className="text-sm text-gray-500">None yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
            <table className="w-full text-sm">
              <tbody>
                {recentImpersonations.map((e) => (
                  <tr key={e.id} className="border-t border-gray-800 first:border-t-0">
                    <td className="px-4 py-2 text-gray-300">
                      {e.platformAdmin.fullName}
                    </td>
                    <td className="px-4 py-2 text-gray-400">as</td>
                    <td className="px-4 py-2 text-white">
                      {e.targetUser.fullName} ({e.targetUser.role})
                    </td>
                    <td className="px-4 py-2 text-gray-500">{e.targetOrgName}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {fmt(e.startedAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {e.endedAt ? (
                        <span className="text-xs text-gray-500">ended</span>
                      ) : (
                        <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-300">
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
