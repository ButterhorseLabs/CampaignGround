import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCampaignAccess } from "@/lib/api-auth";
import { parseQuery } from "@/lib/api-validate";
import { paginationSchema } from "@/lib/validation/shared";
import { buildDoors } from "@/lib/walk-list";

// precinctId "none" is the "No precinct" walk list.
const doorsQuerySchema = paginationSchema.extend({
  campaignId: z.string().optional(),
  precinctId: z.string().min(1),
});

// One page of doors in a walk list, in street order.
export async function GET(req: NextRequest) {
  const query = parseQuery(req.nextUrl.searchParams, doorsQuerySchema);
  if ("error" in query) return query.error;
  const { campaignId, precinctId, limit, offset } = query.data;
  const access = await requireCampaignAccess(campaignId ?? null);
  if ("error" in access) return access.error;

  // ponytail: sorts one precinct in memory (parsed house numbers can't be
  // ordered by Prisma); move ordering into SQL if precincts grow past ~50k voters.
  const voters = await db.voter.findMany({
    where: { campaignId: access.campaignId, precinctId: precinctId === "none" ? null : precinctId },
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

  return NextResponse.json({ items: doors.slice(offset, offset + limit), total: doors.length, offset, limit });
}
