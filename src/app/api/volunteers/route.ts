import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireCampaignAccess } from "@/lib/api-auth";
import { parseBody } from "@/lib/api-validate";
import { volunteerCreateSchema, volunteerPatchSchema } from "@/lib/validation/volunteer";
import { linkOwnVolunteer } from "@/lib/own-volunteer";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const campaignId = sp.get("campaignId");
  const access = await requireCampaignAccess(campaignId);
  if ("error" in access) return access.error;

  const volunteers = await db.volunteer.findMany({
    where: { campaignId: access.campaignId },
    orderBy: [{ status: "asc" }, { hoursLogged: "desc" }],
    include: {
      _count: { select: { assignedTasks: true, canvassLogs: true, callLogs: true } },
    },
  });

  return NextResponse.json({ items: volunteers });
}

export async function PATCH(req: NextRequest) {
  const parsed = await parseBody(req, volunteerPatchSchema);
  if ("error" in parsed) return parsed.error;
  const { id, status, role, hoursLogged, notes } = parsed.data;

  const volunteer = await db.volunteer.findUnique({ where: { id }, select: { campaignId: true } });
  if (!volunteer) return NextResponse.json({ error: "not found" }, { status: 404 });

  const access = await requireCampaignAccess(volunteer.campaignId);
  if ("error" in access) return access.error;

  const data: Prisma.VolunteerUpdateInput = {};
  if (status) data.status = status;
  if (role) data.role = role;
  if (hoursLogged !== undefined) data.hoursLogged = hoursLogged;
  if (notes !== undefined) data.notes = notes;
  const updated = await db.volunteer.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, volunteerCreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;
  const access = await requireCampaignAccess(body.campaignId);
  if ("error" in access) return access.error;

  if ("self" in body) {
    return NextResponse.json(await linkOwnVolunteer(access.campaignId, access.userId));
  }

  const volunteer = await db.volunteer.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      role: body.role ?? "general",
      status: body.status ?? "active",
      zip: body.zip || null,
      notes: body.notes || null,
      campaignId: access.campaignId,
    },
  });
  return NextResponse.json(volunteer);
}
