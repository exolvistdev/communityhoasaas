// Seed logins (prisma/seed.ts) — password is the same for every demo account.
// Re-seed with `npm run db:seed` if these ever stop working.
export const DEMO_PASSWORD = "demo-password-123";

export const ACCOUNTS = {
  admin: { email: "admin@sample-hoa.ph", role: "ADMIN" },
  homeowner: { email: "juan@example.com", role: "HOMEOWNER" },
  guard: { email: "guard@sample-hoa.ph", role: "GUARD" },
  platform: { email: "superadmin@hoasaas.ph", role: "PLATFORM_ADMIN" },
} as const;

export type AccountKey = keyof typeof ACCOUNTS;

/** Where each role's storageState (cookies) gets saved by auth.setup.ts. */
export const authFile = (key: AccountKey) => `test/e2e/.auth/${key}.json`;
