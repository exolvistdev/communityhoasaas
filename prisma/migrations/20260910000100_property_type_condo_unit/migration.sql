-- Condominium units are a distinct property type (RA 4726) — separate from the
-- RESIDENTIAL house-and-lot. Its own migration per repo rule: a new enum value
-- must commit before any migration or code uses it.
ALTER TYPE "PropertyType" ADD VALUE 'CONDO_UNIT';
