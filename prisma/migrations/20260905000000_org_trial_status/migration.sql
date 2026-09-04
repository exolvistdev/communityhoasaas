-- Self-serve signup now starts a 30-day trial; a platform admin manually
-- activates an org once the customer has settled a contract/payment outside
-- the app. status defaults to ACTIVE so every existing org (seeded or live)
-- is unaffected — only app/onboarding/actions.ts explicitly sets TRIAL.
CREATE TYPE "OrgStatus" AS ENUM ('TRIAL', 'ACTIVE');

ALTER TABLE "organizations" ADD COLUMN "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "organizations" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "activatedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "activatedById" TEXT;

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_activatedById_fkey"
  FOREIGN KEY ("activatedById") REFERENCES "platform_admins"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
