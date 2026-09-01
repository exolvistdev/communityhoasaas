import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getHomeownerContext } from "@/lib/portal";

export const metadata = { title: "Announcements · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });

export default async function PortalAnnouncementsPage() {
  const { org } = await getHomeownerContext();

  const announcements = await prisma.announcement.findMany({
    where: { orgId: org.id, publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <Link href="/portal" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-gray-900">Announcements</h1>

      {announcements.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          No announcements yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <h2 className="font-medium text-gray-900">{a.title}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                {a.body}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                {a.publishedAt ? fmt(a.publishedAt) : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
