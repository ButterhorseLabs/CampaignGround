import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { DashboardMetrics } from "@/lib/types";
import { requireCampaignAccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  const access = await requireCampaignAccess(campaignId);
  if ("error" in access) return access.error;

  const campaign = await db.campaign.findUnique({ where: { id: access.campaignId } });
  if (!campaign) {
    return NextResponse.json({ error: "no campaign" }, { status: 404 });
  }

  const [
    votersCount,
    votersContactedRaw,
    supportersCount,
    teammates,
    invitesSent,
    volunteersCount,
    eventsCount,
    tasksOpen,
    callsCount,
    supportBreakdownRaw,
    canvassByDayRaw,
    callsByDayRaw,
    upcomingEvents,
    recentCanvass,
    recentCalls,
    recentEvents,
    recentTasks,
    precinctRows,
    fundraising,
  ] = await Promise.all([
    db.voter.count({ where: { campaignId: campaign.id } }),
    db.voter.findMany({
      where: { campaignId: campaign.id, OR: [
        { callLogs: { some: { outcome: "contacted" } } },
        { canvassLogs: { some: { outcome: "contacted" } } },
      ]},
      select: { id: true },
    }),
    db.voter.count({
      where: { campaignId: campaign.id, supportLevel: { in: ["strong-support", "lean-support"] } },
    }),
    db.campaignMembership.count({ where: { campaignId: campaign.id } }),
    db.invite.count({ where: { campaignId: campaign.id } }),
    db.volunteer.count({ where: { campaignId: campaign.id } }),
    db.event.count({ where: { campaignId: campaign.id } }),
    db.task.count({ where: { campaignId: campaign.id, status: { in: ["todo", "in-progress", "blocked"] } } }),
    db.callLog.count({ where: { campaignId: campaign.id } }),
    db.voter.groupBy({
      by: ["supportLevel"],
      where: { campaignId: campaign.id },
      _count: { _all: true },
    }),
    db.canvassLog.findMany({
      where: { campaignId: campaign.id },
      select: { contactedAt: true, householdId: true, voterId: true, id: true },
    }),
    db.callLog.findMany({
      where: { campaignId: campaign.id },
      select: { calledAt: true },
    }),
    db.event.findMany({
      where: { campaignId: campaign.id, startTime: { gte: new Date() }, status: "scheduled" },
      orderBy: { startTime: "asc" },
      take: 5,
      include: { _count: { select: { attendees: true } } },
    }),
    db.canvassLog.findMany({
      where: { campaignId: campaign.id },
      include: { voter: { select: { firstName: true, lastName: true } } },
      orderBy: { contactedAt: "desc" },
      take: 4,
    }),
    db.callLog.findMany({
      where: { campaignId: campaign.id },
      include: { voter: { select: { firstName: true, lastName: true } } },
      orderBy: { calledAt: "desc" },
      take: 4,
    }),
    db.event.findMany({
      where: { campaignId: campaign.id },
      orderBy: { startTime: "desc" },
      take: 3,
      include: { _count: { select: { attendees: true } } },
    }),
    db.task.findMany({
      where: { campaignId: campaign.id, status: { not: "done" } },
      orderBy: { updatedAt: "desc" },
      take: 4,
      include: { volunteer: { select: { firstName: true, lastName: true } } },
    }),
    db.precinct.findMany({
      where: { campaignId: campaign.id, voters: { some: {} } },
      include: {
        voters: {
          where: { campaignId: campaign.id },
          select: { supportLevel: true, id: true },
        },
      },
    }),
    // Donor data never leaves the server for members.
    access.role === "owner" ? loadFundraising(campaign.id, campaign.fundraisingGoalCents) : null,
  ]);

  // Build canvass/calls by-day (last 14 days)
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const canvassByDay = days.map((d) => {
    const k = dayKey(d);
    return {
      day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: canvassByDayRaw.filter((c) => dayKey(new Date(c.contactedAt)) === k).length,
    };
  });
  const callsByDay = days.map((d) => {
    const k = dayKey(d);
    return {
      day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: callsByDayRaw.filter((c) => dayKey(new Date(c.calledAt)) === k).length,
    };
  });

  const votersContactedIds = new Set(votersContactedRaw.map((v) => v.id));
  const votersContacted = votersContactedIds.size;

  // Recent activity feed
  const recentActivity: DashboardMetrics["recentActivity"] = [];
  fundraising?.recent.slice(0, 3).forEach((d) => {
    recentActivity.push({
      kind: "donation",
      label: `${d.donor?.firstName ?? ""} ${d.donor?.lastName ?? ""} donated`,
      sub: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(d.amountCents / 100),
      at: d.donationDate,
    });
  });
  recentCanvass.slice(0, 3).forEach((c) => {
    recentActivity.push({
      kind: "canvass",
      label: `Visited ${c.voter?.firstName ?? ""} ${c.voter?.lastName ?? ""}`,
      sub: c.outcome,
      at: c.contactedAt.toISOString(),
    });
  });
  recentCalls.slice(0, 3).forEach((c) => {
    recentActivity.push({
      kind: "call",
      label: `Called ${c.voter?.firstName ?? ""} ${c.voter?.lastName ?? ""}`,
      sub: c.outcome,
      at: c.calledAt.toISOString(),
    });
  });
  recentEvents.slice(0, 2).forEach((e) => {
    recentActivity.push({
      kind: "event",
      label: e.title,
      sub: e.startTime.toLocaleDateString(),
      at: e.startTime.toISOString(),
    });
  });
  recentTasks.slice(0, 2).forEach((t) => {
    recentActivity.push({
      kind: "task",
      label: t.title,
      sub: t.status,
      at: t.updatedAt.toISOString(),
    });
  });
  recentActivity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // Precincts summary
  const precincts = precinctRows.map((p) => {
    const total = p.voters.length;
    const supporters = p.voters.filter((v) => v.supportLevel === "strong-support" || v.supportLevel === "lean-support").length;
    const contacted = p.voters.filter((v) => votersContactedIds.has(v.id)).length;
    return { name: p.name, supporters, contacted, total };
  });

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
      voters: votersCount,
      votersContacted,
      supporters: supportersCount,
      teammates,
      invitesSent,
      volunteers: volunteersCount,
      events: eventsCount,
      tasksOpen,
      // A door is a household; voters without one count as their own door.
      canvassDoors: new Set(canvassByDayRaw.map((c) => c.householdId ?? c.voterId ?? c.id)).size,
      callsMade: callsCount,
    },
    fundraising,
    outreach: {
      supportBreakdown: supportBreakdownRaw.map((s) => ({ level: s.supportLevel, count: s._count._all })),
      canvassByDay,
      callsByDay,
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
    recentActivity: recentActivity.slice(0, 8),
    precincts,
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
  const raisedCents = raisedAgg._sum.amountCents ?? 0;
  return {
    raisedCents,
    goalCents,
    percent: goalCents > 0 ? (raisedCents / goalCents) * 100 : 0,
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
