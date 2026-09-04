/**
 * Runs `prisma migrate deploy` during a **Production** Vercel build, before
 * `next build` — so a schema change ships before the code that needs it, and a
 * failed migration blocks the promotion instead of 500-ing in prod.
 *
 * No-op everywhere else: local `npm run build`, CI's build job, and Vercel
 * Preview builds all have `VERCEL_ENV` unset or != "production".
 *
 * To go back to a manual migration gate, drop this from the `build` script.
 */
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DIRECT_URL) {
    throw new Error(
      "DIRECT_URL is required for `prisma migrate deploy` on a Production build. " +
        "Set it in Vercel → Project Settings → Environment Variables."
    );
  }
  console.log("Production build — applying migrations (prisma migrate deploy)…");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(
    `Skipping migrate deploy (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`
  );
}
