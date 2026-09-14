/** @type {import('next').NextConfig} */

// On Vercel, fail the *build* loudly if a required env var is missing — otherwise
// the app deploys fine and every request 500s at runtime with a cryptic
// PrismaClientInitializationError. Local dev / CI (no VERCEL) are untouched.
const REQUIRED_ENV = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
if (process.env.VERCEL) {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in Vercel → Project Settings → Environment Variables (Production), then redeploy.`
    );
  }
}

const nextConfig = {
  reactStrictMode: true,
  // recharts ships a mix of CJS/ESM; transpiling it avoids interop errors in the
  // App Router bundle.
  transpilePackages: ["recharts"],
  // Don't advertise the framework in responses.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Authenticated pages (dashboard/portal/platform) shouldn't be
          // frameable — there's no legitimate reason for this app to be
          // embedded, and it closes off clickjacking against write actions.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Reset-link / invite-link / pass-code URLs carry sensitive tokens
          // or ids — don't leak the full URL to third-party sites via Referer.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Denied by default everywhere; the /guard block below re-grants
          // just camera, just there, for the QR scanner.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // app/guard/GuardScanner.tsx uses getUserMedia — grant camera only on
        // this route, not app-wide, so the permission's blast radius matches
        // the one feature that actually needs it.
        source: "/guard/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
