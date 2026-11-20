import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireCampaignAccess, assertBelongsToCampaign } from "@/lib/api-auth";
import { parseBody, parseQuery } from "@/lib/api-validate";
import { paginationSchema } from "@/lib/validation/shared";
import { voterCreateSchema, voterIdSchema, voterPatchSchema } from "@/lib/validation/voter";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const support = sp.get("support"); // comma separated
  const party = sp.get("party"); // comma separated
  const precinctId = sp.get("precinctId");
  const contactedOnly = sp.get("contacted") === "1";
  const sort = sp.get("sort") === "precinct" ? "precinct" : "name";
  const dir = sp.get("dir") === "desc" ? "desc" : "asc";
  const pagination = parseQuery(sp, paginationSchema);
  if ("error" in pagination) return pagination.error;
  const { limit, offset } = pagination.data;
  const campaignId = sp.get("campaignId");
  const access = await requireCampaignAccess(campaignId);
  if ("error" in access) return access.error;

  const where: Prisma.VoterWhereInput = { campaignId: access.campaignId };
  const and: Prisma.VoterWhereInput[] = [];
  if (q) {
    and.push({ OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { registeredAddress: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ] });
  }
  if (support) {
    where.supportLevel = { in: support.split(",") };
  }
  if (party) {
    where.partyAffiliation = { in: party.split(",") };
  }
  if (precinctId) {
    where.precinctId = precinctId;
  }
  if (contactedOnly) {
    and.push({ OR: [
      { callLogs: { some: { outcome: "contacted" } } },
      { canvassLogs: { some: { outcome: "contacted" } } },
    ] });
  }
  if (and.length) where.AND = and;

  const byName: Prisma.VoterOrderByWithRelationInput[] = [{ lastName: dir }, { firstName: dir }];

  const [voters, total] = await Promise.all([
    db.voter.findMany({
      where,
      orderBy: sort === "precinct" ? [{ precinct: { name: dir } }, ...byName] : byName,
      take: limit,
      skip: offset,
      include: {
        precinct: { select: { name: true, code: true } },
        household: { select: { address: true } },
        _count: { select: { callLogs: true, canvassLogs: true } },
      },
    }),
    db.voter.count({ where }),
  ]);

  // A voter's donations are their donor's. Donation counts are donor data: owners only.
  let items = voters;
  if (access.role === "owner") {
    const donors = await db.donor.findMany({
      where: { campaignId: access.campaignId, voterId: { in: voters.map((v) => v.id) } },
      select: { voterId: true, _count: { select: { donations: true } } },
    });
    const donations = new Map(donors.map((d) => [d.voterId, d._count.donations]));
    items = voters.map((v) => ({ ...v, _count: { ...v._count, donations: donations.get(v.id) ?? 0 } }));
  }

  return NextResponse.json({
    items,
    total,
    offset,
    limit,
  });
}

export async function PATCH(req: NextRequest) {
  const parsed = await parseBody(req, voterPatchSchema);
  if ("error" in parsed) return parsed.error;
  const { id, firstName, lastName, phone, email, registeredAddress, supportLevel, notes, volunteer, hasYardSign, hasBumperSticker, tags } = parsed.data;

  const voter = await db.voter.findUnique({
    where: { id },
    select: { campaignId: true, firstName: true, lastName: true, registeredAddress: true },
  });
  if (!voter) return NextResponse.json({ error: "not found" }, { status: 404 });
  const access = await requireCampaignAccess(voter.campaignId);
  if ("error" in access) return access.error;

  const data: Prisma.VoterUpdateInput = {};
  if (firstName !== undefined || lastName !== undefined || registeredAddress !== undefined) {
    const address = registeredAddress === undefined ? voter.registeredAddress : registeredAddress || null;
    const duplicate = await duplicateVoterResponse(
      access.campaignId,
      { firstName: firstName ?? voter.firstName, lastName: lastName ?? voter.lastName, registeredAddress: address },
      id
    );
    if (duplicate) return duplicate;
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (registeredAddress !== undefined) {
      data.registeredAddress = address;
      // An imported voter's household is the door at their old address; a new
      // street address is a different door, so they walk as their own until re-imported.
      if (address?.toLowerCase() !== voter.registeredAddress?.toLowerCase()) data.household = { disconnect: true };
    }
  }
  if (phone !== undefined) data.phone = phone || null;
  if (email !== undefined) data.email = email || null;
  if (supportLevel) {
    data.supportLevel = supportLevel;
    data.supportLevelSource = "manual";
  }
  if (notes !== undefined) data.notes = notes;
  if (volunteer !== undefined) data.volunteer = volunteer;
  if (hasYardSign !== undefined) data.hasYardSign = hasYardSign;
  if (hasBumperSticker !== undefined) data.hasBumperSticker = hasBumperSticker;
  if (tags !== undefined) data.tags = tags;

  const updated = await db.voter.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const parsed = await parseBody(req, voterIdSchema);
  if ("error" in parsed) return parsed.error;
  const { id } = parsed.data;

  const voter = await db.voter.findUnique({
    where: { id },
    select: {
      campaignId: true,
      firstName: true,
      lastName: true,
      _count: { select: { callLogs: true, canvassLogs: true } },
    },
  });
  if (!voter) return NextResponse.json({ error: "not found" }, { status: 404 });
  const access = await requireCampaignAccess(voter.campaignId, { role: "owner" });
  if ("error" in access) return access.error;

  // Outreach history blocks deletion rather than cascading: deleting the logs
  // would shrink the dashboard's calls and doors, and orphaning them would
  // leave "Unknown voter" rows that can't be tied back to anyone.
  if (voter._count.callLogs + voter._count.canvassLogs > 0) {
    return NextResponse.json(
      { error: `${voter.firstName} ${voter.lastName} has contact attempts on record, so they can't be deleted. Correct their details instead.` },
      { status: 409 }
    );
  }

  // A claim only means someone has this voter open; release it. Donor, task and
  // RSVP links are cleared by their ON DELETE SET NULL foreign keys.
  await db.$transaction([
    db.contactClaim.deleteMany({ where: { voterId: id } }),
    db.voter.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}

// One person per name and street address (case-insensitive); with no address,
// only another addressless voter of the same name counts as the same person.
async function duplicateVoterResponse(
  campaignId: string,
  voter: { firstName: string; lastName: string; registeredAddress?: string | null },
  excludeId?: string
) {
  const duplicate = await db.voter.findFirst({
    where: {
      campaignId,
      id: excludeId ? { not: excludeId } : undefined,
      firstName: { equals: voter.firstName, mode: "insensitive" },
      lastName: { equals: voter.lastName, mode: "insensitive" },
      registeredAddress: voter.registeredAddress
        ? { equals: voter.registeredAddress, mode: "insensitive" }
        : null,
    },
    select: { id: true },
  });
  if (!duplicate) return null;
  return NextResponse.json(
    { error: `${voter.firstName} ${voter.lastName}${voter.registeredAddress ? " at this address" : ""} is already on your voter list.` },
    { status: 409 }
  );
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, voterCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { campaignId, precinctId, supportLevel, ...fields } = parsed.data;
  const access = await requireCampaignAccess(campaignId);
  if ("error" in access) return access.error;

  const precinctErr = await assertBelongsToCampaign(db.precinct, precinctId, access.campaignId, "precinct");
  if (precinctErr) return precinctErr;

  const duplicate = await duplicateVoterResponse(access.campaignId, fields);
  if (duplicate) return duplicate;

  const voter = await db.voter.create({
    data: {
      firstName: fields.firstName,
      lastName: fields.lastName,
      email: fields.email || null,
      phone: fields.phone || null,
      partyAffiliation: fields.partyAffiliation || null,
      registeredAddress: fields.registeredAddress || null,
      notes: fields.notes || null,
      tags: fields.tags || null,
      supportLevel: supportLevel ?? "unknown",
      precinctId: precinctId || null,
      campaignId: access.campaignId,
    },
  });
  return NextResponse.json(voter);
}