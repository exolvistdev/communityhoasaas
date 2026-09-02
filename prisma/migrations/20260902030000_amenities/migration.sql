-- CreateEnum
CREATE TYPE "AmenityBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "amenities" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "feeNote" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "openHour" INTEGER NOT NULL DEFAULT 8,
    "closeHour" INTEGER NOT NULL DEFAULT 22,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "maxHours" INTEGER NOT NULL DEFAULT 4,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amenity_bookings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "propertyId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AmenityBookingStatus" NOT NULL DEFAULT 'PENDING',
    "purpose" TEXT,
    "invoiceId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amenity_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "amenities_orgId_idx" ON "amenities"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "amenity_bookings_invoiceId_key" ON "amenity_bookings"("invoiceId");

-- CreateIndex
CREATE INDEX "amenity_bookings_amenityId_startAt_idx" ON "amenity_bookings"("amenityId", "startAt");

-- CreateIndex
CREATE INDEX "amenity_bookings_orgId_status_idx" ON "amenity_bookings"("orgId", "status");

-- CreateIndex
CREATE INDEX "amenity_bookings_requesterId_idx" ON "amenity_bookings"("requesterId");

-- AddForeignKey
ALTER TABLE "amenities" ADD CONSTRAINT "amenities_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenity_bookings" ADD CONSTRAINT "amenity_bookings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenity_bookings" ADD CONSTRAINT "amenity_bookings_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenity_bookings" ADD CONSTRAINT "amenity_bookings_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenity_bookings" ADD CONSTRAINT "amenity_bookings_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amenity_bookings" ADD CONSTRAINT "amenity_bookings_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
