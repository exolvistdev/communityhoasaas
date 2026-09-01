import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { getCurrentOrgContext } from "@/lib/tenant";
import { can, isStaff, PERMISSION_DENIED, type Action } from "@/lib/permissions";

export { can, isStaff, denyUnlessRole, type Action } from "@/lib/permissions";

/** Async guard for server actions — resolves the caller and checks in one go. */
export async function denyUnless(action: Action) {
  const { user } = await getCurrentOrgContext();
  return can(user.role, action) ? null : PERMISSION_DENIED;
}

/**
 * For the `(admin)` layout and staff pages: resolve the org context and bounce
 * GUARD / HOMEOWNER users to their own portal.
 */
export async function requireStaff() {
  const ctx = await getCurrentOrgContext();
  if (ctx.user.role === "GUARD") redirect("/guard");
  if (ctx.user.role === "HOMEOWNER") redirect("/portal");
  if (!isStaff(ctx.user.role)) redirect("/login");
  return ctx;
}

/** For pages restricted to specific staff roles (e.g. ADMIN-only). */
export async function requireRole(...roles: UserRole[]) {
  const ctx = await requireStaff();
  if (!roles.includes(ctx.user.role)) redirect("/dashboard");
  return ctx;
}

/** For staff pages that require a specific write permission. */
export async function requirePermission(action: Action) {
  const ctx = await requireStaff();
  if (!can(ctx.user.role, action)) redirect("/dashboard");
  return ctx;
}

/**
 * For the GUARD / HOMEOWNER portal pages. No staff bounce — just require that
 * exact role, else send the user to their correct home via `/`.
 */
export async function requirePortalRole(role: UserRole) {
  const ctx = await getCurrentOrgContext();
  if (ctx.user.role !== role) redirect("/");
  return ctx;
}
