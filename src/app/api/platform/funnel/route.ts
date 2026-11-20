import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformOwner } from "@/lib/api-auth";
import { summarizeFunnel, type FunnelRow } from "@/lib/activation-funnel";

interface FunnelQueryRow {
  campaignId: string;
  campaignName: string;
  teamSize: number;
  signedUpAt: Date;
  firstVoterAt: Date | null;
  firstVolunteerAt: Date | null;
  firstInviteAt: Date | null;
  activatedAt: Date | null;
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

// GET /api/platform/funnel — per-campaign setup step times, signup through
// activation, worked out from records the app already stores. Only times and
// counts leave the database, never record contents (docs/legal/privacy.md).
export async function GET() {
  const access = await requirePlatformOwner();
  if ("error" in access) return access.error;

  // A volunteer "besides the owner" is any roster entry not linked to one of
  // the campaign's owners. Any logged canvass or call is a contact attempt.
  const rows = await db.$queryRaw<FunnelQueryRow[]>`
    SELECT
      c."id" AS "campaignId",
      c."candidateName" AS "campaignName",
      (SELECT COUNT(*)::int FROM "CampaignMembership" m WHERE m."campaignId" = c."id") AS "teamSize",
      c."createdAt" AS "signedUpAt",
      (SELECT MIN(v."createdAt") FROM "Voter" v WHERE v."campaignId" = c."id") AS "firstVoterAt",
      (SELECT MIN(vol."createdAt") FROM "Volunteer" vol
        WHERE vol."campaignId" = c."id"
          AND NOT EXISTS (
            SELECT 1 FROM "CampaignMembership" m
            WHERE m."campaignId" = c."id" AND m."role" = 'owner' AND m."userId" = vol."userId"
          )) AS "firstVolunteerAt",
      (SELECT MIN(i."createdAt") FROM "Invite" i WHERE i."campaignId" = c."id") AS "firstInviteAt",
      LEAST(
        (SELECT MIN(cl."createdAt") FROM "CanvassLog" cl WHERE cl."campaignId" = c."id"),
        (SELECT MIN(ca."createdAt") FROM "CallLog" ca WHERE ca."campaignId" = c."id")
      ) AS "activatedAt"
    FROM "Campaign" c
    ORDER BY c."createdAt" DESC
  `;

  const items: FunnelRow[] = rows.map((r) => ({
    campaignId: r.campaignId,
    campaignName: r.campaignName,
    teamSize: r.teamSize,
    signedUpAt: r.signedUpAt.toISOString(),
    firstVoterAt: iso(r.firstVoterAt),
    firstVolunteerAt: iso(r.firstVolunteerAt),
    firstInviteAt: iso(r.firstInviteAt),
    activatedAt: iso(r.activatedAt),
  }));

  return NextResponse.json({ summary: summarizeFunnel(items), items });
}
