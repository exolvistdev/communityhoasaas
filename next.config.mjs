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
};

export default nextConfig;
