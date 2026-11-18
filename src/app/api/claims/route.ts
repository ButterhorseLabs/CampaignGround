import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCampaignAccess, assertCanActAsVolunteer } from "@/lib/api-auth";
import { parseBody } from "@/lib/api-validate";
import { claimBodySchema } from "@/lib/validation/claim";

// The holder's client renews its claim every minute while the door/call is
// open (see src/lib/claims.ts), so this TTL only reaps abandoned claims.
const CLAIM_TTL_MS = 5 * 60 * 1000;

function isStale(claimedAt: Date) {
  return Date.now() - claimedAt.getTime() > CLAIM_TTL_MS;
}

function volunteerName(v: { firstName: string; lastName: string } | null) {
  return v ? `${v.firstName} ${v.lastName}` : null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const channel = sp.get("channel");
  if (!channel) return NextResponse.json({ error: "channel required" }, { status: 400 });
  const campaignId = sp.get("campaignId");
  const access = await requireCampaignAccess(campaignId);
  if ("error" in access) return access.error;

  const claims = await db.contactClaim.findMany({
    where: { channel, campaignId: access.campaignId },
    include: {
      volunteer: { select: { firstName: true, lastName: true } },
      voter: { select: { householdId: true } },
    },
  });

  const active = claims.filter((c) => !isStale(c.claimedAt));
  const items = active.map((c) => ({
    voterId: c.voterId,
    channel: c.channel,
    volunteerId: c.volunteerId,
    volunteerName: volunteerName(c.volunteer),
    claimedAt: c.claimedAt.toISOString(),
  }));

  // A canvass claim covers the whole door: mark every housemate as claimed too.
  if (channel === "canvass") {
    const byHousehold = new Map(
      active.filter((c) => c.voter.householdId).map((c) => [c.voter.householdId!, c])
    );
    if (byHousehold.size > 0) {
      const housemates = await db.voter.findMany({
        where: {
          campaignId: access.campaignId,
          householdId: { in: [...byHousehold.keys()] },
          id: { notIn: active.map((c) => c.voterId) },
        },
        select: { id: true, householdId: true },
      });
      for (const v of housemates) {
        const c = byHousehold.get(v.householdId!)!;
        items.push({
          voterId: v.id,
          channel: c.channel,
          volunteerId: c.volunteerId,
          volunteerName: volunteerName(c.volunteer),
          claimedAt: c.claimedAt.toISOString(),
        });
      }
    }
  }

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, claimBodySchema);
  if ("error" in parsed) return parsed.error;
  const { voterId, channel, volunteerId } = parsed.data;

  const voter = await db.voter.findUnique({
    where: { id: voterId },
    select: { campaignId: true, householdId: true },
  });
  if (!voter) return NextResponse.json({ error: "voter not found" }, { status: 404 });
  const access = await requireCampaignAccess(voter.campaignId);
  if ("error" in access) return access.error;

  const actErr = await assertCanActAsVolunteer(access, volunteerId);
  if (actErr) return actErr;

  // Canvass claims conflict across the whole household; calls stay per voter.
  const conflicts = await db.contactClaim.findMany({
    where: {
      channel,
      volunteerId: { not: volunteerId },
      ...(channel === "canvass" && voter.householdId
        ? { voter: { householdId: voter.householdId, campaignId: voter.campaignId } }
        : { voterId }),
    },
    include: { volunteer: { select: { firstName: true, lastName: true } } },
  });
  const conflict = conflicts.find((c) => !isStale(c.claimedAt));
  if (conflict) {
    return NextResponse.json(
      { error: "claimed", claimedBy: volunteerName(conflict.volunteer) ?? "another volunteer" },
      { status: 409 }
    );
  }
  // ponytail: check-then-upsert is not atomic across housemates; two volunteers
  // claiming different housemates within the same few ms can both succeed. Add a
  // household-keyed claim row if that shows up in practice.

  const claim = await db.contactClaim.upsert({
    where: { voterId_channel: { voterId, channel } },
    create: { voterId, channel, volunteerId, campaignId: voter.campaignId },
    update: { volunteerId, claimedAt: new Date() },
  });

  return NextResponse.json(claim);
}

export async function DELETE(req: NextRequest) {
  const parsed = await parseBody(req, claimBodySchema);
  if ("error" in parsed) return parsed.error;
  const { voterId, channel, volunteerId } = parsed.data;

  const existing = await db.contactClaim.findUnique({
    where: { voterId_channel: { voterId, channel } },
  });

  if (!existing) return NextResponse.json({ ok: true });

  const access = await requireCampaignAccess(existing.campaignId);
  if ("error" in access) return access.error;

  const actErr = await assertCanActAsVolunteer(access, volunteerId);
  if (actErr) return actErr;

  if (existing.volunteerId !== volunteerId && !isStale(existing.claimedAt)) {
    return NextResponse.json({ error: "not your claim" }, { status: 403 });
  }

  await db.contactClaim.delete({ where: { voterId_channel: { voterId, channel } } });
  return NextResponse.json({ ok: true });
}
