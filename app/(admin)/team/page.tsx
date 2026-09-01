import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { TeamManager } from "./TeamManager";

export const metadata = { title: "Team · HOA SaaS" };

export default async function TeamPage() {
  const { org, user: me } = await requireRole("ADMIN");

  const members = await prisma.user.findMany({
    where: { orgId: org.id, deactivatedAt: null },
    orderBy: [{ acceptedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
  });

  return (
    <TeamManager
      selfId={me.id}
      members={members.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        role: m.role,
        accepted: Boolean(m.acceptedAt),
      }))}
    />
  );
}
