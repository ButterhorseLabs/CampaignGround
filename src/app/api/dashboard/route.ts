import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { DashboardMetrics, DashboardTask } from "@/lib/types";
import { requireCampaignAccess } from "@/lib/api-auth";

const OPEN_TASK = ["todo", "in-progress", "blocked"];
const SUPPORTER = ["strong-support", "lean-support"];
const DAY_MS = 86_400_000;
const TREND_DAYS = 14;

/** The viewer's IANA time zone if it's a real one, else UTC. */
function timeZoneOf(raw: string | null): string {
  if (!raw) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw });
    return raw;
  } catch {
    return "UTC";
  }
}

/** YYYY-MM-DD for an instant, as a calendar day in `tz`. */
const localDay = (at: Date, tz: string) => at.toLocaleDateString("en-CA", { timeZone: tz });

// Everything the home screen shows, counted on the server so every figure is
// whole-campaign and explainable. Days ("yesterday", the 14-day trend) are
// calendar days in the viewer's time zone (`tz`).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const access = await requireCampaignAccess(sp.get("campaignId"));
  if ("error" in access) return access.error;
  const tz = timeZoneOf(sp.get("tz"));
  const isOwner = access.role === "owner";
  const campaignId = access.campaignId;

  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return NextResponse.json({ error: "no campaign" }, { status: 404 });

  const now = new Date();
  const today = localDay(now, tz);
  const yesterday = localDay(new Date(now.getTime() - DAY_MS), tz);
  const trendDays = Array.from({ length: TREND_DAYS }, (_, i) => localDay(new Date(now.getTime() - (TREND_DAYS - 1 - i) * DAY_MS), tz));
  // Due dates are calendar days stored at midnight UTC.
  const todayDue = new Date(`${today}T00:00:00Z`);
  const contacted = { outcome: "contacted" };
  const me = isOwner
    ? null
    : await db.volunteer.findFirst({ where: { campaignId, userId: access.userId }, select: { id: true } });

  const [
    voters,
    votersContacted,
    supporters,
    teammates,
    invitesSent,
    volunteers,
    upcomingEventCount,
    tasksOpen,
    tasksOverdue,
    [visitTotals],
    callsMade,
    callsContacted,
    supportBreakdown,
    visitsByDay,
    callsByDay,
    todayTasks,
    upcomingEvents,
    recentCanvass,
    recentCalls,
    recentEvents,
    recentTasks,
    precincts,
    fundraising,
  ] = await Promise.all([
    db.voter.count({ where: { campaignId } }),
    db.voter.count({ where: { campaignId, OR: [{ callLogs: { some: contacted } }, { canvassLogs: { some: contacted } }] } }),
    db.voter.count({ where: { campaignId, supportLevel: { in: SUPPORTER } } }),
    db.campaignMembership.count({ where: { campaignId } }),
    db.invite.count({ where: { campaignId } }),
    db.volunteer.count({ where: { campaignId } }),
    db.event.count({ where: { campaignId, status: "scheduled", startTime: { gte: now } } }),
    db.task.count({ where: { campaignId, status: { in: OPEN_TASK } } }),
    db.task.count({ where: { campaignId, status: { in: OPEN_TASK }, dueDate: { lt: todayDue } } }),
    // A door is a household; a visit without one counts the voter (or the visit) as its own door.
    db.$queryRaw<{ visits: number; doors: number }[]>`
      SELECT COUNT(*)::int AS "visits", COUNT(DISTINCT COALESCE("householdId", "voterId", "id"))::int AS "doors"
      FROM "CanvassLog" WHERE "campaignId" = ${campaignId}`,
    db.callLog.count({ where: { campaignId } }),
    db.callLog.count({ where: { campaignId, outcome: "contacted" } }),
    db.voter.groupBy({ by: ["supportLevel"], where: { campaignId }, _count: { _all: true } }),
    db.$queryRaw<{ day: string; n: number }[]>`
      SELECT to_char(("contactedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "n"
      FROM "CanvassLog"
      WHERE "campaignId" = ${campaignId} AND "contactedAt" >= ${new Date(now.getTime() - (TREND_DAYS + 1) * DAY_MS)}
      GROUP BY 1`,
    db.$queryRaw<{ day: string; n: number }[]>`
      SELECT to_char(("calledAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS "day", COUNT(*)::int AS "n"
      FROM "CallLog"
      WHERE "campaignId" = ${campaignId} AND "calledAt" >= ${new Date(now.getTime() - (TREND_DAYS + 1) * DAY_MS)}
      GROUP BY 1`,
    // Owners: everything due today or overdue. Members: their own open tasks.
    db.task.findMany({
      where: isOwner
        ? { campaignId, status: { in: OPEN_TASK }, dueDate: { lte: todayDue } }
        : { campaignId, status: { in: OPEN_TASK }, assignedVolunteerId: me?.id ?? "none" },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 5,
      include: { volunteer: { select: { firstName: true, lastName: true } } },
    }),
    db.event.findMany({
      where: { campaignId, startTime: { gte: now }, status: "scheduled" },
      orderBy: { startTime: "asc" },
      take: 5,
      include: { _count: { select: { attendees: { where: { rsvpStatus: { in: ["registered", "attended"] } } } } } },
    }),
    db.canvassLog.findMany({
      where: { campaignId },
      include: { voter: { select: { firstName: true, lastName: true } }, household: { select: { address: true } } },
      orderBy: { contactedAt: "desc" },
      take: 3,
    }),
    db.callLog.findMany({
      where: { campaignId },
      include: { voter: { select: { firstName: true, lastName: true } } },
      orderBy: { calledAt: "desc" },
      take: 3,
    }),
    // Only events that have happened belong in recent activity.
    db.event.findMany({
      where: { campaignId, startTime: { lte: now }, status: { not: "cancelled" } },
      orderBy: { startTime: "desc" },
      take: 2,
    }),
    db.task.findMany({
      where: { campaignId },
      orderBy: { updatedAt: "desc" },
      take: 2,
    }),
    db.$queryRaw<{ name: string; total: number; supporters: number; contacted: number }[]>`
      SELECT p."name",
             COUNT(*)::int AS "total",
             (COUNT(*) FILTER (WHERE v."supportLevel" IN ('strong-support', 'lean-support')))::int AS "supporters",
             (COUNT(*) FILTER (WHERE
               EXISTS (SELECT 1 FROM "CallLog" c WHERE c."voterId" = v."id" AND c."outcome" = 'contacted')
               OR EXISTS (SELECT 1 FROM "CanvassLog" k WHERE k."voterId" = v."id" AND k."outcome" = 'contacted')))::int AS "contacted"
      FROM "Precinct" p JOIN "Voter" v ON v."precinctId" = p."id"
      WHERE p."campaignId" = ${campaignId}
      GROUP BY p."id", p."name"`,
    // Donor data never leaves the server for members.
    isOwner ? loadFundraising(campaignId, campaign.fundraisingGoalCents) : null,
  ]);

  const countOn = (rows: { day: string; n: number }[], day: string) => rows.find((r) => r.day === day)?.n ?? 0;
  const tasks: DashboardTask[] = todayTasks.map((t) => {
    const due = t.dueDate?.toISOString().slice(0, 10) ?? null;
    return {
      id: t.id,
      title: t.title,
      dueDate: due,
      overdue: due !== null && due < today,
      assignee: t.volunteer ? `${t.volunteer.firstName} ${t.volunteer.lastName}` : null,
    };
  });

  const fullName = (p: { firstName: string; lastName: string } | null | undefined) => (p ? `${p.firstName} ${p.lastName}` : null);
  const recentActivity: DashboardMetrics["recentActivity"] = [
    ...(fundraising?.recent.slice(0, 3).map((d) => ({
      kind: "donation" as const,
      label: `${fullName(d.donor) ?? "A donor"} gave`,
      sub: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(d.amountCents / 100),
      at: d.donationDate,
    })) ?? []),
    ...recentCanvass.map((c) => ({
      kind: "canvass" as const,
      label: `Visited ${fullName(c.voter) ?? c.household?.address ?? "a door"}`,
      status: c.outcome,
      at: c.contactedAt.toISOString(),
    })),
    ...recentCalls.map((c) => ({
      kind: "call" as const,
      label: `Called ${fullName(c.voter) ?? "a voter"}`,
      status: c.outcome,
      at: c.calledAt.toISOString(),
    })),
    ...recentEvents.map((e) => ({
      kind: "event" as const,
      label: e.title,
      sub: e.location ?? undefined,
      at: e.startTime.toISOString(),
    })),
    ...recentTasks.map((t) => ({ kind: "task" as const, label: t.title, status: t.status, at: t.updatedAt.toISOString() })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const result: DashboardMetrics = {
    campaign: {
      candidateName: campaign.candidateName,
      officeSought: campaign.officeSought,
      district: campaign.district,
      party: campaign.party,
      electionDate: campaign.electionDate.toISOString(),
      fundraisingGoalCents: campaign.fundraisingGoalCents,
      voteGoal: campaign.voteGoal,
    },
    totals: {
      voters,
      votersContacted,
      supporters,
      teammates,
      invitesSent,
      volunteers,
      upcomingEvents: upcomingEventCount,
      tasksOpen,
      tasksOverdue,
      canvassDoors: visitTotals.doors,
      canvassVisits: visitTotals.visits,
      callsMade,
      callsContacted,
    },
    today: {
      tasks,
      yesterday: { visits: countOn(visitsByDay, yesterday), calls: countOn(callsByDay, yesterday) },
      onRoster: isOwner || !!me,
    },
    fundraising,
    outreach: {
      supportBreakdown: supportBreakdown.map((s) => ({ level: s.supportLevel, count: s._count._all })),
      byDay: trendDays.map((date) => ({ date, visits: countOn(visitsByDay, date), calls: countOn(callsByDay, date) })),
    },
    upcomingEvents: upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      type: e.type,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime?.toISOString() ?? null,
      location: e.location,
      address: e.address,
      capacity: e.capacity,
      status: e.status,
      notes: e.notes,
      campaignId: e.campaignId,
      attendeeCount: e._count.attendees,
      createdAt: e.createdAt.toISOString(),
    })),
    recentActivity,
    precincts: precincts.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true })),
  };

  return NextResponse.json(result);
}

async function loadFundraising(campaignId: string, goalCents: number): Promise<NonNullable<DashboardMetrics["fundraising"]>> {
  const [donors, donations, raisedAgg, recentDonations, donationsByMethodRaw] = await Promise.all([
    db.donor.count({ where: { campaignId } }),
    db.donation.count({ where: { campaignId } }),
    db.donation.aggregate({ where: { campaignId }, _sum: { amountCents: true } }),
    db.donation.findMany({
      where: { campaignId },
      include: { donor: true },
      orderBy: { donationDate: "desc" },
      take: 5,
    }),
    db.donation.groupBy({
      by: ["method"],
      where: { campaignId },
      _sum: { amountCents: true },
    }),
  ]);
  return {
    raisedCents: raisedAgg._sum.amountCents ?? 0,
    goalCents,
    donors,
    donations,
    byMethod: donationsByMethodRaw.map((d) => ({ method: d.method, totalCents: d._sum.amountCents ?? 0 })),
    recent: recentDonations.map((d) => ({
      id: d.id,
      amountCents: d.amountCents,
      donationDate: d.donationDate.toISOString(),
      method: d.method,
      inKindDescription: d.inKindDescription,
      earmarkNote: d.earmarkNote,
      complianceVerified: d.complianceVerified,
      notes: d.notes,
      campaignId: d.campaignId,
      donorId: d.donorId,
      donor: d.donor
        ? {
            id: d.donor.id,
            firstName: d.donor.firstName,
            lastName: d.donor.lastName,
            email: d.donor.email,
            phone: d.donor.phone,
            type: d.donor.type,
            capacity: d.donor.capacity,
            isRecurring: d.donor.isRecurring,
            campaignId: d.donor.campaignId,
            createdAt: d.donor.createdAt.toISOString(),
            updatedAt: d.donor.updatedAt.toISOString(),
          }
        : undefined,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}
