import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireCampaignAccess, assertBelongsToCampaign, assertCanActAsVolunteer, assertCanUndoContact } from "@/lib/api-auth";
import { parseBody, parseQuery } from "@/lib/api-validate";
import { paginationSchema } from "@/lib/validation/shared";
import { callCreateSchema } from "@/lib/validation/call";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outcome = sp.get("outcome");
  const pagination = parseQuery(sp, paginationSchema);
  if ("error" in pagination) return pagination.error;
  const { limit } = pagination.data;
  const campaignId = sp.get("campaignId");
  const access = await requireCampaignAccess(campaignId);
  if ("error" in access) return access.error;

  const where: Prisma.CallLogWhereInput = { campaignId: access.campaignId };
  if (outcome) where.outcome = outcome;

  const [logs, [summary]] = await Promise.all([
    db.callLog.findMany({
      where,
      orderBy: { calledAt: "desc" },
      include: {
        voter: { select: { firstName: true, lastName: true, phone: true, precinct: { select: { name: true } } } },
        volunteer: { select: { firstName: true, lastName: true } },
      },
      take: limit,
    }),
    // Campaign-wide totals: never narrowed by the outcome filter or capped by the page size.
    db.$queryRaw<{ calls: number; contacted: number; noAnswer: number; avgLengthSec: number }[]>`
      SELECT COUNT(*)::int AS "calls",
             (COUNT(*) FILTER (WHERE "outcome" = 'contacted'))::int AS "contacted",
             (COUNT(*) FILTER (WHERE "outcome" = 'no-answer'))::int AS "noAnswer",
             COALESCE(ROUND(AVG("callLengthSec") FILTER (WHERE "callLengthSec" > 0)), 0)::int AS "avgLengthSec"
      FROM "CallLog" WHERE "campaignId" = ${access.campaignId}`,
  ]);

  return NextResponse.json({
    items: logs.map((l) => ({
      ...l,
      calledAt: l.calledAt.toISOString(),
      createdAt: l.createdAt.toISOString(),
    })),
    summary,
  });
}

// Undo a call just logged.
export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const access = await requireCampaignAccess(sp.get("campaignId"));
  if ("error" in access) return access.error;

  const log = await db.callLog.findFirst({
    where: { id: sp.get("id") ?? "", campaignId: access.campaignId },
    select: { id: true, volunteerId: true, supportLevel: true },
  });
  if (!log) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  const err = await assertCanUndoContact(access, { volunteerId: log.volunteerId, changedVoter: !!log.supportLevel }, "call");
  if (err) return err;

  await db.callLog.delete({ where: { id: log.id } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, callCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { voterId, volunteerId, campaignId, outcome, supportLevel, issuePriority, notes, callLengthSec } = parsed.data;
  const access = await requireCampaignAccess(campaignId);
  if ("error" in access) return access.error;

  const [voterErr, volunteerErr] = await Promise.all([
    assertBelongsToCampaign(db.voter, voterId, access.campaignId, "voter"),
    volunteerId ? assertCanActAsVolunteer(access, volunteerId) : null,
  ]);
  if (voterErr) return voterErr;
  if (volunteerErr) return volunteerErr;

  const log = await db.callLog.create({
    data: {
      voterId,
      volunteerId,
      campaignId: access.campaignId,
      outcome: outcome ?? "no-answer",
      supportLevel,
      issuePriority,
      notes,
      callLengthSec: callLengthSec ?? 0,
    },
  });

  if (voterId && supportLevel) {
    await db.voter.update({
      where: { id: voterId },
      data: { supportLevel, supportLevelSource: "call" },
    });
  }

  return NextResponse.json(log);
}
