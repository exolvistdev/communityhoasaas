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
        <Link href="/platform" className="text-sm text-gray-400 hover:text-white">
          ← Organizations
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-white">{org.name}</h1>
        <p className="text-sm text-gray-400">
          {org.subdomain} · {org.plan} plan · {org._count.properties} properties
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 text-left text-gray-400">
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
              <tr key={u.id} className="border-t border-gray-800">
                <td className="px-4 py-2.5 font-medium text-white">
                  {u.fullName}
                </td>
                <td className="px-4 py-2.5 text-gray-400">{u.email}</td>
                <td className="px-4 py-2.5 text-gray-300">{u.role}</td>
                <td className="px-4 py-2.5">
                  {u.acceptedAt ? (
                    <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-300">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-300">
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
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
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
