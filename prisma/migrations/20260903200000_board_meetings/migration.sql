-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'HELD', 'CANCELLED');
CREATE TYPE "RsvpResponse" AS ENUM ('YES', 'NO', 'MAYBE');

-- CreateTable
CREATE TABLE "board_meetings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "agenda" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "minutesDocumentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_meetings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "board_meetings_orgId_scheduledAt_idx" ON "board_meetings"("orgId", "scheduledAt");

-- CreateTable
CREATE TABLE "meeting_rsvps" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" "RsvpResponse" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_rsvps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "meeting_rsvps_meetingId_userId_key" ON "meeting_rsvps"("meetingId", "userId");
CREATE INDEX "meeting_rsvps_meetingId_idx" ON "meeting_rsvps"("meetingId");

-- AddForeignKey
ALTER TABLE "board_meetings" ADD CONSTRAINT "board_meetings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "board_meetings" ADD CONSTRAINT "board_meetings_minutesDocumentId_fkey" FOREIGN KEY ("minutesDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "board_meetings" ADD CONSTRAINT "board_meetings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_rsvps" ADD CONSTRAINT "meeting_rsvps_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "board_meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_rsvps" ADD CONSTRAINT "meeting_rsvps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
