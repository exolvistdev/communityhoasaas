import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve the current Supabase-authenticated user as a platform admin.
 * A `PlatformAdmin` is deliberately not a `User` / `UserRole` — it isn't part
 * of any org. Anonymous → /platform/login. Authenticated but not a platform
 * admin → their normal tenant home (`/`), not a loop back to platform/login.
 */
export async function requirePlatformAdmin() {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/platform/login");

  const admin = await prisma.platformAdmin.findUnique({
    where: { authId: authUser.id },
  });
  if (!admin) redirect("/");

  return { authUser, admin };
}
