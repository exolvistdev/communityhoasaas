import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [
  "/dashboard",
  "/properties",
  "/billing",
  "/reconciliation",
  "/ledger",
  "/reports",
  "/statements",
  "/gate-passes",
  "/announcements",
  "/vendors",
  "/bills",
  "/violations",
  "/violation-letters",
  "/violation-photos",
  "/maintenance",
  "/maintenance-files",
  "/meetings",
  "/team",
  "/audit",
  "/data-requests",
  "/settings",
  "/marketplace",
  "/amenities",
  "/documents",
  "/guard",
  "/portal",
  "/account",
  "/notifications",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Platform operator console — separate auth surface, its own login page.
  const isPlatform = path === "/platform" || path.startsWith("/platform/");
  const isPlatformLogin = path === "/platform/login";

  if (isPlatform && !isPlatformLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/platform/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isPlatformLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/platform";
    return NextResponse.redirect(url);
  }

  const needsAuth = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (path === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/"; // app/page.tsx routes by role
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
