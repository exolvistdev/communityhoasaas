-- Adding a value to an existing enum must be its own migration: it cannot be
-- used in the same transaction it is added in.
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REFUNDED';
