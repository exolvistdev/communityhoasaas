-- Users: opt-out toggle + soft-delete marker
ALTER TABLE "users" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- Listings: expiry + bump/sort key
ALTER TABLE "marketplace_listings" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "marketplace_listings" ADD COLUMN "bumpedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "marketplace_listings" SET "expiresAt" = "createdAt" + INTERVAL '30 days', "bumpedAt" = "createdAt";
ALTER TABLE "marketplace_listings" ALTER COLUMN "expiresAt" SET NOT NULL;

DROP INDEX "marketplace_listings_orgId_status_createdAt_idx";
CREATE INDEX "marketplace_listings_orgId_status_bumpedAt_idx" ON "marketplace_listings"("orgId", "status", "bumpedAt");

-- Conversations: moderator freeze
ALTER TABLE "market_conversations" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "market_conversations" ADD COLUMN "closedReason" TEXT;

-- CreateTable
CREATE TABLE "conversation_reports" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "conversation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_blocks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_reports_conversationId_idx" ON "conversation_reports"("conversationId");
CREATE UNIQUE INDEX "conversation_reports_conversationId_reporterId_key" ON "conversation_reports"("conversationId", "reporterId");
CREATE INDEX "marketplace_blocks_orgId_idx" ON "marketplace_blocks"("orgId");
CREATE UNIQUE INDEX "marketplace_blocks_blockerId_blockedId_key" ON "marketplace_blocks"("blockerId", "blockedId");

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "market_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_blocks" ADD CONSTRAINT "marketplace_blocks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_blocks" ADD CONSTRAINT "marketplace_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketplace_blocks" ADD CONSTRAINT "marketplace_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
