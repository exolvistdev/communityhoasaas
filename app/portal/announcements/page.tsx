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
      <Link href="/portal" className="text-sm text-fg-muted hover:text-fg">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-fg">Announcements</h1>

      {announcements.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm text-fg-muted">
          No announcements yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <h2 className="font-medium text-fg">{a.title}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-fg-muted">
                {a.body}
              </p>
              <p className="mt-2 text-xs text-fg-subtle">
                {a.publishedAt ? fmt(a.publishedAt) : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
