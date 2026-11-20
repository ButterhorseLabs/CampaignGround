-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "countyVoterId" TEXT;

-- CreateIndex
CREATE INDEX "Voter_campaignId_countyVoterId_idx" ON "Voter"("campaignId", "countyVoterId");
