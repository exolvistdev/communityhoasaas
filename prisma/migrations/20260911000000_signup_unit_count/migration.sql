-- Approximate unit/lot count captured at signup and on the quote form.
-- Both nullable and additive — safe to apply while the previous build runs.

ALTER TABLE "organizations" ADD COLUMN "estimatedUnits" INTEGER;

ALTER TABLE "leads" ADD COLUMN "propertyCount" INTEGER;
