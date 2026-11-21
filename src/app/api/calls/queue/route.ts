import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCampaignAccess } from "@/lib/api-auth";
import { CLAIM_TTL_MS } from "@/lib/validation/claim";

const QUEUE_SIZE = 20;
// Unanswered calls come back to the queue after this long.
const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

interface QueueVoter {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  supportLevel: string;
  precinctName: string | null;
  lastOutcome: string | null;
  lastCalledAt: string | null;
}

// The next voters to call: persuadable voters with a phone, minus anyone who
// was reached, refused, or had a wrong number, anyone tried in the last day,
// and anyone another caller is on. Never-called voters first, then the
// longest-waiting. Also returns the campaign facts the call script quotes.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const access = await requireCampaignAccess(sp.get("campaignId"));
  if ("error" in access) return access.error;
  const volunteerId = sp.get("volunteerId") ?? "";
  const retryBefore = new Date(Date.now() - RETRY_AFTER_MS);
  const claimedSince = new Date(Date.now() - CLAIM_TTL_MS);

  const [rows, campaign] = await Promise.all([
    db.$queryRaw<(Omit<QueueVoter, "lastCalledAt"> & { lastCalledAt: Date | null; remaining: number })[]>`
      SELECT v."id", v."firstName", v."lastName", v."phone", v."supportLevel",
             p."name" AS "precinctName", lc."outcome" AS "lastOutcome", lc."calledAt" AS "lastCalledAt",
             (COUNT(*) OVER ())::int AS "remaining"
      FROM "Voter" v
      LEFT JOIN "Precinct" p ON p."id" = v."precinctId"
      LEFT JOIN LATERAL (
        SELECT c."outcome", c."calledAt" FROM "CallLog" c
        WHERE c."voterId" = v."id" ORDER BY c."calledAt" DESC LIMIT 1
      ) lc ON true
      WHERE v."campaignId" = ${access.campaignId}
        AND COALESCE(v."phone", '') <> ''
        AND v."supportLevel" IN ('undecided', 'lean-support', 'unknown')
        AND (lc."outcome" IS NULL
             OR (lc."outcome" IN ('no-answer', 'voicemail', 'call-back') AND lc."calledAt" < ${retryBefore}))
        AND NOT EXISTS (
          SELECT 1 FROM "ContactClaim" cc
          WHERE cc."voterId" = v."id" AND cc."channel" = 'call'
            AND cc."volunteerId" <> ${volunteerId} AND cc."claimedAt" > ${claimedSince}
        )
      ORDER BY lc."calledAt" ASC NULLS FIRST, v."lastName", v."firstName", v."id"
      LIMIT ${QUEUE_SIZE}`,
    db.campaign.findUniqueOrThrow({
      where: { id: access.campaignId },
      select: { candidateName: true, officeSought: true, district: true, electionDate: true },
    }),
  ]);

  return NextResponse.json({
    items: rows.map(({ remaining: _remaining, ...v }) => ({ ...v, lastCalledAt: v.lastCalledAt?.toISOString() ?? null })),
    remaining: rows[0]?.remaining ?? 0,
    campaign: { ...campaign, electionDate: campaign.electionDate.toISOString() },
  });
}
