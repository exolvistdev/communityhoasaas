-- AlterTable
ALTER TABLE "users" ADD COLUMN "notificationPrefs" JSONB;

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DUES_ISSUED', 'PAYMENT_CONFIRMED', 'PAYMENT_REJECTED', 'PAYMENT_SUBMITTED', 'INVOICE_OVERDUE', 'ANNOUNCEMENT', 'AMENITY_BOOKING_REQUESTED', 'AMENITY_BOOKING_DECIDED', 'AMENITY_BOOKING_CANCELLED', 'MARKETPLACE_MESSAGE', 'MARKETPLACE_LISTING_REPORTED', 'MARKETPLACE_LISTING_MODERATED', 'MARKETPLACE_CONVERSATION_REPORTED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
