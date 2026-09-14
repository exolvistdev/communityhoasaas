-- Last-resort guard against a negative resident credit balance. The app now
-- guards every decrement with a `creditBalance >= amount` WHERE clause, but
-- this constraint is the actual guarantee if a future code path forgets to.
ALTER TABLE "properties"
  ADD CONSTRAINT "properties_credit_balance_non_negative" CHECK ("creditBalance" >= 0);
