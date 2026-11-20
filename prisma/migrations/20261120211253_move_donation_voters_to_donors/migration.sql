-- Hand-written data migration. The next (generated) migration drops the
-- per-donation voter link, leaving a donor's voter as the only donor-to-voter
-- link. First move a donation's voter onto its donor when the donor has none.
-- Each donor takes the voter of its latest such donation (same
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
