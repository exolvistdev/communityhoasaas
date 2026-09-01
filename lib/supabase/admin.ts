import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS and can manage auth users.
 * SERVER ONLY. Never import this into a Client Component.
 * Used during onboarding to create the first admin with a pre-confirmed email.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
