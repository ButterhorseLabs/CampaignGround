-- A donor's voter is the only donor-to-voter link. Before dropping the
-- per-donation link, move a donation's voter onto its donor when the donor
-- has none. Each donor takes the voter of its latest such donation (same
-- campaign only). Donor."voterId" is unique, so a voter already linked to a
-- donor is skipped, and a voter claimed by more than one donor is left
-- unlinked rather than guessed.
WITH candidate AS (
  SELECT DISTINCT ON (d."donorId") d."donorId", d."voterId"
  FROM "Donation" d
  JOIN "Donor" o ON o."id" = d."donorId"
  JOIN "Voter" v ON v."id" = d."voterId"
  WHERE o."voterId" IS NULL
    AND v."campaignId" = o."campaignId"
    AND NOT EXISTS (SELECT 1 FROM "Donor" x WHERE x."voterId" = d."voterId")
  ORDER BY d."donorId", d."donationDate" DESC, d."id"
),
uncontested AS (
  SELECT "donorId", "voterId" FROM candidate
  WHERE "voterId" IN (SELECT "voterId" FROM candidate GROUP BY "voterId" HAVING count(*) = 1)
)
UPDATE "Donor" o
SET "voterId" = u."voterId"
FROM uncontested u
WHERE o."id" = u."donorId";

-- DropForeignKey
ALTER TABLE "Donation" DROP CONSTRAINT "Donation_voterId_fkey";

-- AlterTable
ALTER TABLE "Donation" DROP COLUMN "voterId";
