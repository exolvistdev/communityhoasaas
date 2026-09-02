-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('EXPORT', 'DELETION');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "privacyContactEmail" TEXT;

-- CreateTable
CREATE TABLE "data_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DataRequestType" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_requests_orgId_status_idx" ON "data_requests"("orgId", "status");

-- CreateIndex
CREATE INDEX "data_requests_userId_idx" ON "data_requests"("userId");

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
