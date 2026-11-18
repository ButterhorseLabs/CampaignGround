import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireCampaignAccess } from "@/lib/api-auth";
import { parseBody } from "@/lib/api-validate";
import { volunteerCreateSchema, volunteerPatchSchema } from "@/lib/validation/volunteer";

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
    return NextResponse.json(await linkSelf(access.campaignId, access.userId));
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

// Returns the caller's own roster entry, linking it first if needed: an
// existing linked row wins, then an unlinked row with the caller's email
// (same rule as invite acceptance), otherwise a new row from the account.
async function linkSelf(campaignId: string, userId: string) {
  const existing = await db.volunteer.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
  });
  if (existing) return existing;

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });

  try {
    const unlinked = user.email
      ? await db.volunteer.findFirst({
          where: { campaignId, userId: null, email: { equals: user.email, mode: "insensitive" } },
          orderBy: { createdAt: "asc" },
        })
      : null;
    if (unlinked) {
      return await db.volunteer.update({ where: { id: unlinked.id }, data: { userId } });
    }

    const [firstName, ...rest] = (user.name ?? "").trim().split(/\s+/).filter(Boolean);
    return await db.volunteer.create({
      data: {
        firstName: firstName ?? user.email?.split("@")[0] ?? "Volunteer",
        lastName: rest.join(" "),
        email: user.email,
        role: "general",
        status: "active",
        userId,
        campaignId,
      },
    });
  } catch (e) {
    // A concurrent request linked this user first: return that row.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return db.volunteer.findUniqueOrThrow({
        where: { campaignId_userId: { campaignId, userId } },
      });
    }
    throw e;
  }
}
