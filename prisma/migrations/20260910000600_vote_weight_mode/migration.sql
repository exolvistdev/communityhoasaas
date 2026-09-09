-- Weighted voting for condominiums (RA 4726). Defaults to ONE_UNIT_ONE_VOTE, so
-- every existing org's elections and resolutions tally exactly as before —
-- weight is only applied when an admin switches this in Settings (or onboarding
-- sets BY_FLOOR_AREA for a CONDOMINIUM org).
CREATE TYPE "VoteWeightMode" AS ENUM ('ONE_UNIT_ONE_VOTE', 'BY_FLOOR_AREA', 'BY_COMMON_SHARE');

ALTER TABLE "organizations"
    ADD COLUMN "voteWeightMode" "VoteWeightMode" NOT NULL DEFAULT 'ONE_UNIT_ONE_VOTE';
