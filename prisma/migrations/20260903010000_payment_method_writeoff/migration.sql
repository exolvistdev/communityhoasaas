-- Adding a value to an existing enum must be its own migration: it cannot be
-- used in the same transaction it is added in, and `migrate deploy` runs each
-- migration file in one transaction.
ALTER TYPE "PaymentMethod" ADD VALUE 'WRITE_OFF';
