-- Per-square-metre dues (condominiums). BY_TYPE stays the default, so every
-- existing org keeps computing dues exactly as before; onboarding sets PER_SQM
-- only for CONDOMINIUM orgs. The typeRateCondoUnit / typeRateParking columns
-- mirror the existing per-type default columns for the two new property types.
CREATE TYPE "DuesRateMode" AS ENUM ('BY_TYPE', 'PER_SQM');

ALTER TABLE "organizations"
    ADD COLUMN "duesRateMode" "DuesRateMode" NOT NULL DEFAULT 'BY_TYPE',
    ADD COLUMN "duesRatePerSqm" DECIMAL(12,2),
    ADD COLUMN "typeRateCondoUnit" DECIMAL(12,2),
    ADD COLUMN "typeRateParking" DECIMAL(12,2);
