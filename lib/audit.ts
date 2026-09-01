import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";

/**
 * Record an admin action for the audit trail. Called from server actions
 * after the mutation succeeds. Never throws — a logging hiccup must not break
 * the action it's logging.
 */
export async function logAudit(entry: {
  action: string;
  target?: string;
  detail?: string;
}) {
  try {
    const { org, user } = await getCurrentOrgContext();
    await prisma.auditEvent.create({
      data: {
        orgId: org.id,
        actorId: user.id,
        actorName: user.fullName,
        action: entry.action,
        target: entry.target ?? null,
        detail: entry.detail ?? null,
      },
    });
  } catch {
    // best-effort only
  }
}
