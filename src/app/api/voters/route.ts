import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireCampaignAccess, assertBelongsToCampaign } from "@/lib/api-auth";
import { parseBody, parseQuery } from "@/lib/api-validate";
import { paginationSchema } from "@/lib/validation/shared";
import { voterCreateSchema, voterPatchSchema } from "@/lib/validation/voter";

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
        _count: {
          // Donation counts are donor data: owners only.
          select: { callLogs: true, canvassLogs: true, donations: access.role === "owner" },
        },
      },
    }),
    db.voter.count({ where }),
  ]);

  return NextResponse.json({
    items: voters,
    total,
    offset,
    limit,
  });
}

export async function PATCH(req: NextRequest) {
  const parsed = await parseBody(req, voterPatchSchema);
  if ("error" in parsed) return parsed.error;
  const { id, supportLevel, notes, volunteer, hasYardSign, hasBumperSticker, tags } = parsed.data;

  const voter = await db.voter.findUnique({ where: { id }, select: { campaignId: true } });
  if (!voter) return NextResponse.json({ error: "not found" }, { status: 404 });
  const access = await requireCampaignAccess(voter.campaignId);
  if ("error" in access) return access.error;

  const data: Prisma.VoterUpdateInput = {};
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

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, voterCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { campaignId, precinctId, supportLevel, ...fields } = parsed.data;
  const access = await requireCampaignAccess(campaignId);
  if ("error" in access) return access.error;

  const precinctErr = await assertBelongsToCampaign(db.precinct, precinctId, access.campaignId, "precinct");
  if (precinctErr) return precinctErr;

  const duplicate = await db.voter.findFirst({
    where: {
      campaignId: access.campaignId,
      firstName: { equals: fields.firstName, mode: "insensitive" },
      lastName: { equals: fields.lastName, mode: "insensitive" },
      registeredAddress: fields.registeredAddress
        ? { equals: fields.registeredAddress, mode: "insensitive" }
        : null,
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `${fields.firstName} ${fields.lastName}${fields.registeredAddress ? " at this address" : ""} is already on your voter list.` },
      { status: 409 }
    );
  }

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