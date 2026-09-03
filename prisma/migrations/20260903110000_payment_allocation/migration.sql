-- Payment → invoice allocation layer + per-property resident credit.

-- 2100 Resident Credit (LIABILITY) for every existing org (idempotent).
INSERT INTO "accounts" ("id", "orgId", "code", "name", "type")
SELECT gen_random_uuid()::text, o."id", '2100', 'Resident Credit', 'LIABILITY'::"AccountType"
FROM "organizations" o
ON CONFLICT ("orgId", "code") DO NOTHING;

-- Per-property unapplied resident credit.
ALTER TABLE "properties" ADD COLUMN "creditBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- How much of a payment landed on an invoice (source of truth for "amount paid").
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");
CREATE INDEX "payment_allocations_invoiceId_idx" ON "payment_allocations"("invoiceId");
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A stored resident credit consumed by a later invoice.
CREATE TABLE "credit_applications" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "appliedById" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_applications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "credit_applications_propertyId_idx" ON "credit_applications"("propertyId");
CREATE INDEX "credit_applications_invoiceId_idx" ON "credit_applications"("invoiceId");
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every confirmed payment so far landed 1:1 on its invoice.
INSERT INTO "payment_allocations" ("id", "paymentId", "invoiceId", "amount", "createdAt")
SELECT gen_random_uuid()::text, p."id", p."invoiceId", p."amount", p."paidAt"
FROM "payments" p
WHERE p."status" = 'CONFIRMED';
