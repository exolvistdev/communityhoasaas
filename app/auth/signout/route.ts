import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearImpersonation } from "@/lib/impersonation";

export async function POST(request: Request) {
  const supabase = createClient();
  // If a platform operator signs out mid-impersonation, close the event and
  // drop the cookie so it can't be replayed and doesn't show "ongoing" forever.
  await clearImpersonation().catch(() => {});
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
