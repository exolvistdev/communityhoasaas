-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterTable: User
ALTER TABLE "users" ADD COLUMN "acceptedAt" TIMESTAMP(3);
UPDATE "users" SET "acceptedAt" = "createdAt" WHERE "acceptedAt" IS NULL;

-- AlterTable: Homeowner
ALTER TABLE "homeowners" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "homeowners_userId_key" ON "homeowners"("userId");
ALTER TABLE "homeowners" ADD CONSTRAINT "homeowners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Organization
ALTER TABLE "organizations" ADD COLUMN "gcashNumber" TEXT;
ALTER TABLE "organizations" ADD COLUMN "gcashName" TEXT;
ALTER TABLE "organizations" ADD COLUMN "mayaNumber" TEXT;
ALTER TABLE "organizations" ADD COLUMN "mayaName" TEXT;
ALTER TABLE "organizations" ADD COLUMN "paymentInstructions" TEXT;

-- AlterTable: Payment
ALTER TABLE "payments" ADD COLUMN "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE "payments" ADD COLUMN "note" TEXT;
ALTER TABLE "payments" ADD COLUMN "submittedById" TEXT;
ALTER TABLE "payments" ADD COLUMN "confirmedById" TEXT;
ALTER TABLE "payments" ADD COLUMN "confirmedAt" TIMESTAMP(3);

CREATE INDEX "payments_status_idx" ON "payments"("status");
ALTER TABLE "payments" ADD CONSTRAINT "payments_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: existing payments were all admin-entered and already posted
UPDATE "payments" SET "confirmedAt" = "paidAt" WHERE "status" = 'CONFIRMED' AND "confirmedAt" IS NULL;
