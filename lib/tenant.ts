import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { resolveImpersonation } from "@/lib/impersonation";

/**
 * Resolve the current Supabase-authenticated user and their HOA org.
 *
 * Every server-side data access on a tenant-scoped table should start here
 * and pass `org.id` into the query. Never query a tenant-scoped table with a
 * bare `where: {}` — always scope by orgId.
 *
 * If a platform admin is impersonating someone (see lib/impersonation.ts),
 * this resolves to the *impersonated* user/org instead of the real session —
 * that one branch is what makes impersonation transparent everywhere else in
 * the app.
 *
 * Redirects to /login if unauthenticated, or /onboarding if the auth user
 * has no HOA membership yet.
 */
export async function getCurrentOrgContext() {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const impersonation = await resolveImpersonation();
  if (impersonation) {
    return {
      authUser,
      user: impersonation.user,
      org: impersonation.org,
      impersonating: true as const,
    };
  }

  const user = await prisma.user.findFirst({
    where: { authId: authUser.id },
    include: { org: true },
  });

  if (!user) redirect("/onboarding");
  if (user.deactivatedAt) redirect("/login");

  // First authenticated load after an invite — mark it accepted.
  if (!user.acceptedAt) {
    user.acceptedAt = new Date();
    await prisma.user
      .update({ where: { id: user.id }, data: { acceptedAt: user.acceptedAt } })
      .catch(() => {});
  }

  return { authUser, user, org: user.org, impersonating: false as const };
}

/** Same as above but returns null instead of redirecting — for pages that
 *  need to branch on onboarding state (e.g. the onboarding page itself). */
export async function tryGetOrgContext() {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const impersonation = await resolveImpersonation();
  if (impersonation) {
    return {
      authUser,
      user: impersonation.user,
      org: impersonation.org,
      impersonating: true as const,
    };
  }

  const user = await prisma.user.findFirst({
    where: { authId: authUser.id },
    include: { org: true },
  });

  if (user?.deactivatedAt) redirect("/login");

  return user
    ? { authUser, user, org: user.org, impersonating: false as const }
    : { authUser, user: null, org: null, impersonating: false as const };
}
