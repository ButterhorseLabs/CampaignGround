import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCampaignAccess } from "@/lib/api-auth";
import { NO_PRECINCT } from "@/lib/walk-list";

// Every walk list a canvasser can pick: one per precinct with voters, plus
// "No precinct" when some voters have none.
export async function GET(req: NextRequest) {
  const access = await requireCampaignAccess(req.nextUrl.searchParams.get("campaignId"));
  if ("error" in access) return access.error;

  const [precincts, unassigned] = await Promise.all([
    db.precinct.findMany({
      where: { campaignId: access.campaignId, voters: { some: {} } },
      select: { id: true, name: true, _count: { select: { voters: true } } },
    }),
    db.voter.count({ where: { campaignId: access.campaignId, precinctId: null } }),
  ]);

  const items = precincts
    .map((p) => ({ precinctId: p.id, name: p.name, voterCount: p._count.voters }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  if (unassigned > 0) items.push({ precinctId: NO_PRECINCT, name: "No precinct", voterCount: unassigned });
  return NextResponse.json({ items });
}
