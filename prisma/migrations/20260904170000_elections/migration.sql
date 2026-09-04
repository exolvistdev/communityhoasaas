-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "TrusteePosition" AS ENUM ('CHAIRPERSON', 'VICE_CHAIRPERSON', 'SECRETARY', 'TREASURER', 'MEMBER');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "electionArrearsMonths" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "elections" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "meetingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "quorumPct" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL DEFAULT 12,
    "resultDocumentId" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "elections_orgId_opensAt_idx" ON "elections"("orgId", "opensAt");

-- CreateTable
CREATE TABLE "election_candidates" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "homeownerId" TEXT,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_candidates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "election_candidates_electionId_idx" ON "election_candidates"("electionId");

-- CreateTable
CREATE TABLE "election_ballots" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "castById" TEXT,
    "viaProxyId" TEXT,
    "abstain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "election_ballots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "election_ballots_electionId_propertyId_key" ON "election_ballots"("electionId", "propertyId");
CREATE INDEX "election_ballots_electionId_idx" ON "election_ballots"("electionId");

-- CreateTable
CREATE TABLE "election_votes" (
    "id" TEXT NOT NULL,
    "ballotId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,

    CONSTRAINT "election_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "election_votes_ballotId_candidateId_key" ON "election_votes"("ballotId", "candidateId");
CREATE INDEX "election_votes_candidateId_idx" ON "election_votes"("candidateId");

-- CreateTable
CREATE TABLE "trustees" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "electionId" TEXT,
    "userId" TEXT,
    "homeownerId" TEXT,
    "name" TEXT NOT NULL,
    "position" "TrusteePosition" NOT NULL DEFAULT 'MEMBER',
    "termStart" TIMESTAMP(3) NOT NULL,
    "termEnd" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trustees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "trustees_orgId_termEnd_idx" ON "trustees"("orgId", "termEnd");

-- AddForeignKey
ALTER TABLE "elections" ADD CONSTRAINT "elections_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "elections" ADD CONSTRAINT "elections_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "board_meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "elections" ADD CONSTRAINT "elections_resultDocumentId_fkey" FOREIGN KEY ("resultDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "elections" ADD CONSTRAINT "elections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_candidates" ADD CONSTRAINT "election_candidates_homeownerId_fkey" FOREIGN KEY ("homeownerId") REFERENCES "homeowners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "election_ballots" ADD CONSTRAINT "election_ballots_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_ballots" ADD CONSTRAINT "election_ballots_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_ballots" ADD CONSTRAINT "election_ballots_castById_fkey" FOREIGN KEY ("castById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "election_ballots" ADD CONSTRAINT "election_ballots_viaProxyId_fkey" FOREIGN KEY ("viaProxyId") REFERENCES "vote_proxies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "election_ballots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_votes" ADD CONSTRAINT "election_votes_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "election_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trustees" ADD CONSTRAINT "trustees_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trustees" ADD CONSTRAINT "trustees_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trustees" ADD CONSTRAINT "trustees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trustees" ADD CONSTRAINT "trustees_homeownerId_fkey" FOREIGN KEY ("homeownerId") REFERENCES "homeowners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
