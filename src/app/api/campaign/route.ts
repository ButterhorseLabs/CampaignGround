import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCampaignAccess } from "@/lib/api-auth";
import { parseBody } from "@/lib/api-validate";
import { campaignGoalsSchema } from "@/lib/validation/campaign";

// Owners set the vote and fundraising goals the dashboard measures against.
export async function PATCH(req: NextRequest) {
  const parsed = await parseBody(req, campaignGoalsSchema);
  if ("error" in parsed) return parsed.error;
  const { campaignId, voteGoal, fundraisingGoalCents } = parsed.data;

  const access = await requireCampaignAccess(campaignId, { role: "owner" });
  if ("error" in access) return access.error;

  const updated = await db.campaign.update({
    where: { id: access.campaignId },
    data: { voteGoal, fundraisingGoalCents },
    select: { voteGoal: true, fundraisingGoalCents: true },
  });
  return NextResponse.json(updated);
}
