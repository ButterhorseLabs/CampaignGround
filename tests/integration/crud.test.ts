import { beforeAll, describe, expect, test } from "bun:test";
import { fetchAs, login, seedDemoCampaign, signupAndLogin, uniqueEmail, type TestAccount } from "../helpers/client";
import { TEST_BASE_URL } from "../setup";
import { testDb } from "../helpers/testDb";

let owner: TestAccount;
let member: TestAccount;
let campaignId: string;
let voterId: string;
let volunteerId: string;
let donorId: string;

beforeAll(async () => {
  owner = await signupAndLogin();
  campaignId = await seedDemoCampaign(owner.cookie);

  const [voters, volunteers, donors] = await Promise.all([
    fetchAs(owner.cookie, `/api/voters?campaignId=${campaignId}&limit=1`).then((r) => r.json()),
    fetchAs(owner.cookie, `/api/volunteers?campaignId=${campaignId}`).then((r) => r.json()),
    fetchAs(owner.cookie, `/api/donors?campaignId=${campaignId}`).then((r) => r.json()),
  ]);
  voterId = voters.items[0].id;
  volunteerId = volunteers.items[0].id;
  donorId = donors.items[0].id;

  // Bring `member` in as a real member (not owner) of the same campaign via
  // the actual invite flow, so member-vs-owner authorization is exercised
  // the same way a real user would experience it.
  const memberEmail = uniqueEmail("crud-member");
  const inviteRes = await fetchAs(owner.cookie, "/api/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId, email: memberEmail }),
  });
  expect(inviteRes.status).toBe(200);
  const invite = await testDb.invite.findUniqueOrThrow({
    where: { campaignId_email: { campaignId, email: memberEmail } },
  });
  const acceptRes = await fetch(`${TEST_BASE_URL}/api/invites/token/${invite.token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Crud Member", password: "correcthorsebatterystaple1" }),
  });
  expect(acceptRes.status).toBe(200);
  const memberCookie = await login(memberEmail, "correcthorsebatterystaple1");
  member = { email: memberEmail, password: "correcthorsebatterystaple1", name: "Crud Member", campaignId, cookie: memberCookie };
});

describe("voters", () => {
  test("list is scoped to the campaign and supports filters", async () => {
    const res = await fetchAs(owner.cookie, `/api/voters?campaignId=${campaignId}&support=strong-support`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.every((v: { supportLevel: string }) => v.supportLevel === "strong-support")).toBe(true);
  });

  test("PATCH updates a voter's support level", async () => {
    const res = await fetchAs(owner.cookie, "/api/voters", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: voterId, supportLevel: "lean-oppose", hasYardSign: true }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.supportLevel).toBe("lean-oppose");
    expect(updated.hasYardSign).toBe(true);
  });
});

describe("volunteers", () => {
  test("list includes activity counts", async () => {
    const res = await fetchAs(owner.cookie, `/api/volunteers?campaignId=${campaignId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
  });

  test("PATCH updates status", async () => {
    const res = await fetchAs(owner.cookie, "/api/volunteers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: volunteerId, status: "inactive" }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.status).toBe("inactive");
  });
});

describe("donors", () => {
  test("owner can list donors", async () => {
    const res = await fetchAs(owner.cookie, `/api/donors?campaignId=${campaignId}`);
    expect(res.status).toBe(200);
  });

  test("a member (non-owner) is forbidden from listing donors", async () => {
    const res = await fetchAs(member.cookie, `/api/donors?campaignId=${campaignId}`);
    expect(res.status).toBe(403);
  });
});

describe("events", () => {
  let eventId: string;

  test("create an event", async () => {
    const res = await fetchAs(owner.cookie, "/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Block Party",
        type: "rally",
        startTime: new Date(Date.now() + 86_400_000).toISOString(),
        campaignId,
      }),
    });
    expect(res.status).toBe(200);
    const created = await res.json();
    eventId = created.id;
    expect(created.status).toBe("scheduled");
  });

  test("list includes the created event", async () => {
    const res = await fetchAs(owner.cookie, `/api/events?campaignId=${campaignId}`);
    const body = await res.json();
    expect(body.items.some((e: { id: string }) => e.id === eventId)).toBe(true);
  });

  test("PATCH updates status", async () => {
    const res = await fetchAs(owner.cookie, "/api/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: eventId, status: "cancelled" }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.status).toBe("cancelled");
  });
});

describe("tasks", () => {
  let taskId: string;

  test("create a task assigned to a volunteer", async () => {
    const res = await fetchAs(owner.cookie, "/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Knock 20 doors", campaignId, assignedVolunteerId: volunteerId }),
    });
    expect(res.status).toBe(200);
    const created = await res.json();
    taskId = created.id;
    expect(created.status).toBe("todo");
  });

  test("PATCH updates status and priority", async () => {
    const res = await fetchAs(owner.cookie, "/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: "done", priority: "urgent" }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.status).toBe("done");
    expect(updated.priority).toBe("urgent");
  });
});

describe("canvass logs", () => {
  test("create and filter by outcome", async () => {
    const createRes = await fetchAs(owner.cookie, "/api/canvass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voterId,
        volunteerId,
        campaignId,
        outcome: "contacted",
        supportLevel: "strong-support",
      }),
    });
    expect(createRes.status).toBe(200);

    const listRes = await fetchAs(owner.cookie, `/api/canvass?campaignId=${campaignId}&outcome=contacted`);
    const body = await listRes.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((l: { outcome: string }) => l.outcome === "contacted")).toBe(true);
  });
});

describe("call logs", () => {
  test("create and list", async () => {
    const createRes = await fetchAs(owner.cookie, "/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterId, volunteerId, campaignId, outcome: "contacted", callLengthSec: 90 }),
    });
    expect(createRes.status).toBe(200);

    const listRes = await fetchAs(owner.cookie, `/api/calls?campaignId=${campaignId}`);
    const body = await listRes.json();
    expect(body.items.length).toBeGreaterThan(0);
  });
});

describe("contact claims", () => {
  test("a second volunteer cannot claim an already-claimed voter", async () => {
    const volunteers = await fetchAs(owner.cookie, `/api/volunteers?campaignId=${campaignId}`).then((r) => r.json());
    const [firstVolunteer, secondVolunteer] = volunteers.items;

    const claimRes = await fetchAs(owner.cookie, "/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterId, channel: "canvass", volunteerId: firstVolunteer.id }),
    });
    expect(claimRes.status).toBe(200);

    const conflictRes = await fetchAs(owner.cookie, "/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterId, channel: "canvass", volunteerId: secondVolunteer.id }),
    });
    expect(conflictRes.status).toBe(409);

    const releaseRes = await fetchAs(owner.cookie, "/api/claims", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterId, channel: "canvass", volunteerId: firstVolunteer.id }),
    });
    expect(releaseRes.status).toBe(200);

    const reclaimRes = await fetchAs(owner.cookie, "/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterId, channel: "canvass", volunteerId: secondVolunteer.id }),
    });
    expect(reclaimRes.status).toBe(200);
  });
});

describe("dashboard", () => {
  test("loads without error and totals are internally consistent", async () => {
    const res = await fetchAs(owner.cookie, `/api/dashboard?campaignId=${campaignId}`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totals.voters).toBeGreaterThan(0);
    expect(body.fundraising.donors).toBeGreaterThan(0);

    const donationsRes = await fetchAs(owner.cookie, `/api/donations?campaignId=${campaignId}`);
    const donations = await donationsRes.json();
    expect(body.fundraising.donations).toBe(donations.items.length);

    const sumCents = donations.items.reduce((s: number, d: { amountCents: number }) => s + d.amountCents, 0);
    expect(body.fundraising.raisedCents).toBe(sumCents);

    // Members get no fundraising data at all on the dashboard.
    const memberRes = await fetchAs(member.cookie, `/api/dashboard?campaignId=${campaignId}`);
    const memberBody = await memberRes.json();
    expect(memberBody.fundraising).toBeNull();
  });

  test("events: recent activity is past only, upcoming counts scheduled future events, RSVPs skip cancelled and no-shows", async () => {
    const fresh = await signupAndLogin();
    const day = 86_400_000;
    await testDb.event.create({ data: { campaignId: fresh.campaignId, title: "Past rally", startTime: new Date(Date.now() - day) } });
    await testDb.event.create({ data: { campaignId: fresh.campaignId, title: "Cancelled picnic", status: "cancelled", startTime: new Date(Date.now() + day) } });
    const future = await testDb.event.create({ data: { campaignId: fresh.campaignId, title: "Future town hall", startTime: new Date(Date.now() + 2 * day) } });
    await testDb.eventAttendee.createMany({
      data: ["registered", "attended", "cancelled", "no-show"].map((rsvpStatus) => ({ eventId: future.id, rsvpStatus })),
    });

    const res = await fetchAs(fresh.cookie, `/api/dashboard?campaignId=${fresh.campaignId}&tz=America/Los_Angeles`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.campaign.party).toBeNull();
    expect(body.totals.upcomingEvents).toBe(1);
    expect(body.upcomingEvents.map((e: { title: string }) => e.title)).toEqual(["Future town hall"]);
    expect(body.upcomingEvents[0].attendeeCount).toBe(2);
    const eventLabels = body.recentActivity.filter((a: { kind: string }) => a.kind === "event").map((a: { label: string }) => a.label);
    expect(eventLabels).toEqual(["Past rally"]);
    // The trend's last day is today where the viewer is.
    expect(body.outreach.byDay).toHaveLength(14);
    expect(body.outreach.byDay.at(-1).date).toBe(new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }));

    const badTz = await fetchAs(fresh.cookie, `/api/dashboard?campaignId=${fresh.campaignId}&tz=Not%2FAZone`);
    expect(badTz.status).toBe(200);
  });

  test("members see only their own tasks in their shift", async () => {
    const memberUser = await testDb.user.findUniqueOrThrow({ where: { email: member.email } });
    // Accepting the invite already linked the member to a volunteer record.
    const mine = await testDb.volunteer.findUniqueOrThrow({ where: { campaignId_userId: { campaignId, userId: memberUser.id } } });
    const myTask = await testDb.task.create({ data: { campaignId, title: "Member's own task", assignedVolunteerId: mine.id } });
    await testDb.task.create({ data: { campaignId, title: "Someone else's task", assignedVolunteerId: volunteerId, dueDate: new Date(Date.now() - 86_400_000) } });

    const body = await (await fetchAs(member.cookie, `/api/dashboard?campaignId=${campaignId}`)).json();
    expect(body.today.onRoster).toBe(true);
    expect(body.today.tasks.map((t: { id: string }) => t.id)).toEqual([myTask.id]);
  });

  test("only owners can set campaign goals", async () => {
    const goals = { campaignId, voteGoal: 4200, fundraisingGoalCents: 5_000_000 };
    const patch = (cookie: string) =>
      fetchAs(cookie, "/api/campaign", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(goals) });
    expect((await patch(member.cookie)).status).toBe(403);
    expect((await patch(owner.cookie)).status).toBe(200);
    const body = await (await fetchAs(owner.cookie, `/api/dashboard?campaignId=${campaignId}`)).json();
    expect(body.campaign.voteGoal).toBe(4200);
    expect(body.fundraising.goalCents).toBe(5_000_000);
  });
});
