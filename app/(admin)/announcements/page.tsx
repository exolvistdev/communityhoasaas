import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { AnnouncementsManager } from "./AnnouncementsManager";

export const metadata = { title: "Announcements · HOA SaaS" };

export default async function AnnouncementsPage() {
  const { org } = await getCurrentOrgContext();

  const announcements = await prisma.announcement.findMany({
    where: { orgId: org.id },
    include: { createdBy: { select: { fullName: true } } },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "first" } }, { updatedAt: "desc" }],
  });

  return (
    <AnnouncementsManager
      items={announcements.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        publishedAt: a.publishedAt?.toISOString() ?? null,
        updatedAt: a.updatedAt.toISOString(),
        author: a.createdBy.fullName,
      }))}
    />
  );
}
