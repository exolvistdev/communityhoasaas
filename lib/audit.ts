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
    const ctx = await getCurrentOrgContext();
    // When a platform operator is impersonating, record THEM as the actor —
    // the tenant's own audit trail must not blame the customer for a
    // platform-side action.
    const actorId = ctx.impersonating ? null : ctx.user.id;
    const actorName = ctx.impersonating
      ? `${ctx.realActor.fullName} · platform operator (as ${ctx.user.fullName})`
      : ctx.user.fullName;
    await prisma.auditEvent.create({
      data: {
        orgId: ctx.org.id,
        actorId,
        actorName,
        action: entry.action,
        target: entry.target ?? null,
        detail: entry.detail ?? null,
      },
    });
  } catch (e) {
    // Best-effort — a logging hiccup must not break the action it logs — but
    // surface the failure so audit-trail gaps are detectable (financial
    // actions especially).
    console.error("[audit] failed to record", entry.action, e);
  }
}

/**
 * Audit entry for a background job (cron / script) — no request-scoped user,
 * so the actor is recorded as "System". Never throws.
 */
export async function logSystemAudit(
  orgId: string,
  action: string,
  target?: string,
  detail?: string
) {
  try {
    await prisma.auditEvent.create({
      data: {
        orgId,
        actorId: null,
        actorName: "System",
        action,
        target: target ?? null,
        detail: detail ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] failed to record", action, e);
  }
}
