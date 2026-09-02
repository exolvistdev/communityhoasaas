-- One portal login may now be linked to several units (co-owner of one unit,
-- owner of another, etc.). Drop the unique constraint on Homeowner.userId and
-- replace it with a plain index.
DROP INDEX "homeowners_userId_key";
CREATE INDEX "homeowners_userId_idx" ON "homeowners"("userId");
