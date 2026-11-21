import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCampaignAccess } from "@/lib/api-auth";
import { NO_PRECINCT } from "@/lib/walk-list";

// Every walk list a canvasser can pick: one per precinct with voters, plus
// "No precinct" when some voters have none. Sized in doors, the unit a canvasser walks.
export async function GET(req: NextRequest) {
  const access = await requireCampaignAccess(req.nextUrl.searchParams.get("campaignId"));
  if ("error" in access) return access.error;

  // A door is a household; a voter without one is their own door (same rule as buildDoors).
  const [counts, precincts] = await Promise.all([
    db.$queryRaw<{ precinctId: string | null; doors: number }[]>`
      SELECT "precinctId", COUNT(DISTINCT COALESCE("householdId", "id"))::int AS "doors"
      FROM "Voter" WHERE "campaignId" = ${access.campaignId}
      GROUP BY "precinctId"`,
    db.precinct.findMany({ where: { campaignId: access.campaignId }, select: { id: true, name: true } }),
  ]);
  const doorsIn = new Map(counts.map((c) => [c.precinctId, c.doors]));

  const items = precincts
    .filter((p) => doorsIn.has(p.id))
    .map((p) => ({ precinctId: p.id, name: p.name, doorCount: doorsIn.get(p.id)! }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const unassigned = doorsIn.get(null);
  if (unassigned) items.push({ precinctId: NO_PRECINCT, name: "No precinct", doorCount: unassigned });
  return NextResponse.json({ items });
}
