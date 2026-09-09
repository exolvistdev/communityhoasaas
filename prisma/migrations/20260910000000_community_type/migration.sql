-- Every org is now typed as a subdivision / village / townhouse complex /
-- condominium / mixed-use community. The column drives display vocabulary
-- (lib/terms.ts) and, for CONDOMINIUM, the default dues + vote-weighting modes
-- that onboarding sets.
--
-- Defaults to SUBDIVISION so every existing org (seeded or live) is unaffected —
-- only app/onboarding/actions.ts and Settings ever set anything else. ADD COLUMN
-- NOT NULL DEFAULT backfills every existing row in one statement.
CREATE TYPE "CommunityType" AS ENUM ('SUBDIVISION', 'VILLAGE', 'TOWNHOUSE', 'CONDOMINIUM', 'MIXED');

ALTER TABLE "organizations" ADD COLUMN "communityType" "CommunityType" NOT NULL DEFAULT 'SUBDIVISION';
