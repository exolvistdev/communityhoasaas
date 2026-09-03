-- CreateEnum
CREATE TYPE "VoteStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "VoteChoice" AS ENUM ('YES', 'NO', 'ABSTAIN');
CREATE TYPE "PassThreshold" AS ENUM ('MAJORITY', 'TWO_THIRDS');

-- CreateTable
CREATE TABLE "board_votes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "meetingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "VoteStatus" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "quorumPct" INTEGER NOT NULL,
    "threshold" "PassThreshold" NOT NULL DEFAULT 'MAJORITY',
    "resultDocumentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_votes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "board_votes_orgId_opensAt_idx" ON "board_votes"("orgId", "opensAt");

-- CreateTable
CREATE TABLE "ballots" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "castById" TEXT,
    "viaProxyForId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ballots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ballots_voteId_propertyId_key" ON "ballots"("voteId", "propertyId");
CREATE INDEX "ballots_voteId_idx" ON "ballots"("voteId");

-- CreateTable
CREATE TABLE "vote_proxies" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "grantorPropertyId" TEXT NOT NULL,
    "holderUserId" TEXT NOT NULL,
    "grantedById" TEXT,
    "note" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "vote_proxies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vote_proxies_orgId_idx" ON "vote_proxies"("orgId");
CREATE INDEX "vote_proxies_grantorPropertyId_idx" ON "vote_proxies"("grantorPropertyId");
CREATE INDEX "vote_proxies_holderUserId_idx" ON "vote_proxies"("holderUserId");

-- AddForeignKey
ALTER TABLE "board_votes" ADD CONSTRAINT "board_votes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "board_votes" ADD CONSTRAINT "board_votes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "board_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "board_votes" ADD CONSTRAINT "board_votes_resultDocumentId_fkey" FOREIGN KEY ("resultDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "board_votes" ADD CONSTRAINT "board_votes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ballots" ADD CONSTRAINT "ballots_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "board_votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_castById_fkey" FOREIGN KEY ("castById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_viaProxyForId_fkey" FOREIGN KEY ("viaProxyForId") REFERENCES "vote_proxies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vote_proxies" ADD CONSTRAINT "vote_proxies_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vote_proxies" ADD CONSTRAINT "vote_proxies_grantorPropertyId_fkey" FOREIGN KEY ("grantorPropertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vote_proxies" ADD CONSTRAINT "vote_proxies_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vote_proxies" ADD CONSTRAINT "vote_proxies_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
