import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCampaignAccess } from "@/lib/api-auth";
import { parseQuery } from "@/lib/api-validate";
import { walkListDoorsQuerySchema } from "@/lib/validation/walk-list";
import { buildDoors, doorIsDone, NO_PRECINCT, type DoorVisit } from "@/lib/walk-list";

// One page of doors in a walk list, in street order.
export async function GET(req: NextRequest) {
  const query = parseQuery(req.nextUrl.searchParams, walkListDoorsQuerySchema);
  if ("error" in query) return query.error;
  const { campaignId, precinctId, limit, offset } = query.data;
  const access = await requireCampaignAccess(campaignId ?? null);
  if ("error" in access) return access.error;

  // ponytail: sorts one precinct in memory (parsed house numbers can't be
  // ordered by Prisma); move ordering into SQL if precincts grow past ~50k voters.
  const voters = await db.voter.findMany({
    where: { campaignId: access.campaignId, precinctId: precinctId === NO_PRECINCT ? null : precinctId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      supportLevel: true,
      campaignId: true,
      householdId: true,
      registeredAddress: true,
      household: { select: { address: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const doors = buildDoors(voters);

  // The latest visit at each door, by household or by the voter for doors without one.
  const voterIds = voters.map((v) => v.id);
  const householdIds = [...new Set(voters.flatMap((v) => (v.householdId ? [v.householdId] : [])))];
  const logs = await db.canvassLog.findMany({
    where: { campaignId: access.campaignId, OR: [{ voterId: { in: voterIds } }, { householdId: { in: householdIds } }] },
    orderBy: { contactedAt: "desc" },
    select: { voterId: true, householdId: true, outcome: true, contactedAt: true },
  });
  const doorOfVoter = new Map(voters.map((v) => [v.id, v.householdId ?? v.id]));
  const lastVisit = new Map<string, DoorVisit>();
  for (const l of logs) {
    const doorId = l.householdId ?? (l.voterId ? doorOfVoter.get(l.voterId) : undefined);
    if (doorId && !lastVisit.has(doorId)) lastVisit.set(doorId, { outcome: l.outcome, contactedAt: l.contactedAt.toISOString() });
  }
  const visited = doors.map((d) => ({ ...d, lastVisit: lastVisit.get(d.id) ?? null }));

  return NextResponse.json({
    items: visited.slice(offset, offset + limit),
    total: visited.length,
    done: visited.filter(doorIsDone).length,
    offset,
    limit,
  });
}
