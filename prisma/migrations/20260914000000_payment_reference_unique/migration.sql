-- A confirmed GCash/Maya/bank-transfer reference identifies one real-world
-- transaction. The app already rejects a second confirmation of the same
-- (method, reference) pair, but that check-then-act race isn't safe under
-- concurrent requests — this index is the actual guarantee. Case- and
-- whitespace-insensitive (UPPER(TRIM(...))) so "abc123" and " Abc123 " are
-- treated as the same reference without needing to backfill existing rows.
CREATE UNIQUE INDEX "payments_method_reference_confirmed_key"
  ON "payments" ("method", (UPPER(TRIM("reference"))))
  WHERE "status" = 'CONFIRMED' AND "reference" IS NOT NULL;
