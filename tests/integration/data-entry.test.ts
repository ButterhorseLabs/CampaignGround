import { beforeAll, describe, expect, test } from "bun:test";
import { fetchAs, login, signupAndLogin, uniqueEmail, type TestAccount } from "../helpers/client";
import { TEST_BASE_URL } from "../setup";
import { testDb } from "../helpers/testDb";

let owner: TestAccount;
let member: TestAccount;
let campaignId: string;

function post(cookie: string, path: string, body: unknown) {
  return fetchAs(cookie, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  // A fresh, empty campaign: the first-run path these features exist for.
  owner = await signupAndLogin();
  campaignId = owner.campaignId;

  const memberEmail = uniqueEmail("data-entry-member");
  const inviteRes = await post(owner.cookie, "/api/invites", { campaignId, email: memberEmail });
  expect(inviteRes.status).toBe(200);
  const invite = await testDb.invite.findUniqueOrThrow({
    where: { campaignId_email: { campaignId, email: memberEmail } },
  });
  const acceptRes = await fetch(`${TEST_BASE_URL}/api/invites/token/${invite.token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Data Member", password: "correcthorsebatterystaple1" }),
  });
  expect(acceptRes.status).toBe(200);
  member = {
    email: memberEmail,
    password: "correcthorsebatterystaple1",
    name: "Data Member",
    campaignId,
    cookie: await login(memberEmail, "correcthorsebatterystaple1"),
  };
});

describe("manual data entry", () => {
  test("a member can add a voter", async () => {
    const res = await post(member.cookie, "/api/voters", {
      campaignId,
      firstName: "Rosa",
      lastName: "Member-Added",
      phone: "555-0100",
      supportLevel: "lean-support",
    });
    expect(res.status).toBe(200);
    const voter = await res.json();
    expect(voter.campaignId).toBe(campaignId);
    expect(voter.supportLevel).toBe("lean-support");
  });

  test("a voter needs a first and last name", async () => {
    const res = await post(member.cookie, "/api/voters", { campaignId, firstName: "Only" });
    expect(res.status).toBe(400);
  });

  test("adding the same person at the same address twice is refused", async () => {
    const voter = { campaignId, firstName: "Dupe", lastName: "Checker", registeredAddress: "9 Elm St" };
    expect((await post(member.cookie, "/api/voters", voter)).status).toBe(200);

    const again = await post(member.cookie, "/api/voters", { ...voter, firstName: "dupe", registeredAddress: "9 ELM ST" });
    expect(again.status).toBe(409);
    expect((await again.json()).error).toContain("already on your voter list");

    // Same name at a different address is a different person.
    const elsewhere = await post(member.cookie, "/api/voters", { ...voter, registeredAddress: "10 Elm St" });
    expect(elsewhere.status).toBe(200);
  });

  test("a voter can't be filed under another campaign's precinct", async () => {
    const other = await signupAndLogin();
    const precinct = await testDb.precinct.create({
      data: { name: "Elsewhere", code: "E1", campaignId: other.campaignId },
    });
    const res = await post(owner.cookie, "/api/voters", {
      campaignId,
      firstName: "Wrong",
      lastName: "Precinct",
      precinctId: precinct.id,
    });
    expect(res.status).toBe(400);
  });

  test("members can't add donors; owners can", async () => {
    const donor = { campaignId, firstName: "Dana", lastName: "Giver", type: "individual", capacity: "small" };
    expect((await post(member.cookie, "/api/donors", donor)).status).toBe(403);

    const res = await post(owner.cookie, "/api/donors", donor);
    expect(res.status).toBe(200);
    expect((await res.json()).capacity).toBe("small");
  });

  test("a member can add an unlinked roster volunteer", async () => {
    const res = await post(member.cookie, "/api/volunteers", {
      campaignId,
      firstName: "Vic",
      lastName: "Roster",
      role: "canvasser",
    });
    expect(res.status).toBe(200);
    const volunteer = await res.json();
    expect(volunteer.userId).toBeNull();
    expect(volunteer.role).toBe("canvasser");
  });

  test("self-linking a volunteer is idempotent and sets userId", async () => {
    const user = await testDb.user.findUniqueOrThrow({ where: { email: member.email } });

    const first = await (await post(member.cookie, "/api/volunteers", { campaignId, self: true })).json();
    const second = await (await post(member.cookie, "/api/volunteers", { campaignId, self: true })).json();
    expect(first.userId).toBe(user.id);
    expect(second.id).toBe(first.id);
    expect(await testDb.volunteer.count({ where: { campaignId, userId: user.id } })).toBe(1);

    const list = await (await fetchAs(member.cookie, `/api/volunteers?campaignId=${campaignId}`)).json();
    expect(list.items.find((v: { id: string }) => v.id === first.id).userId).toBe(user.id);
  });
});

describe("voter import", () => {
  const rows = [
    { firstName: "Ana", lastName: "Lopez", address: "12 Main St.", city: "Rivermont", state: "OR", zip: "97000", precinct: "Ward 1" },
    { firstName: "Ben", lastName: "Ortiz", address: "12 Main St", zip: "97000", precinct: "ward 1" },
    { firstName: "  ", lastName: "Nameless", address: "1 Elm St" },
    { firstName: "ana", lastName: "LOPEZ", address: "12  main st" },
    { firstName: "Cy", lastName: "Day", precinct: "Ward 2", supportLevel: "Strong Support" },
  ];

  test("members can't import", async () => {
    expect((await post(member.cookie, "/api/voters/import", { campaignId, rows })).status).toBe(403);
  });

  test("creates voters, precincts, and households and skips bad or duplicate rows", async () => {
    const res = await post(owner.cookie, "/api/voters/import", { campaignId, rows });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(3);
    expect(body.skippedCount).toBe(2);
    expect(body.skipped).toEqual([
      { row: 3, reason: "Missing first or last name" },
      { row: 4, reason: "Duplicate of an existing voter" },
    ]);

    const precincts = await testDb.precinct.findMany({ where: { campaignId }, orderBy: { name: "asc" } });
    expect(precincts.map((p) => [p.name, p.code])).toEqual([["Ward 1", "Ward 1"], ["Ward 2", "Ward 2"]]);

    const voters = await testDb.voter.findMany({
      where: { campaignId, lastName: { in: ["Lopez", "Ortiz", "Day"] } },
      include: { household: true },
    });
    const byLast = Object.fromEntries(voters.map((v) => [v.lastName, v]));
    expect(byLast.Lopez.householdId).not.toBeNull();
    expect(byLast.Ortiz.householdId).toBe(byLast.Lopez.householdId);
    expect(byLast.Lopez.household?.city).toBe("Rivermont");
    expect(byLast.Lopez.registeredAddress).toBe("12 Main St.");
    expect(byLast.Lopez.precinctId).toBe(precincts[0].id);
    expect(byLast.Ortiz.precinctId).toBe(precincts[0].id);
    expect(byLast.Day.householdId).toBeNull();
    expect(byLast.Day.precinctId).toBe(precincts[1].id);
    expect(byLast.Day.supportLevel).toBe("strong-support");
  });

  test("re-importing the same file creates nothing new", async () => {
    const body = await (await post(owner.cookie, "/api/voters/import", { campaignId, rows })).json();
    expect(body.created).toBe(0);
    expect(await testDb.precinct.count({ where: { campaignId } })).toBe(2);
    expect(await testDb.household.count({ where: { campaignId } })).toBe(1);
  });

  test("rejects more than 5000 rows per request", async () => {
    const big = Array.from({ length: 5001 }, (_, i) => ({ firstName: "A", lastName: `B${i}` }));
    expect((await post(owner.cookie, "/api/voters/import", { campaignId, rows: big })).status).toBe(400);
  });
});

describe("donor privacy", () => {
  test("members don't get donation counts from the voter list", async () => {
    const asMember = await (await fetchAs(member.cookie, `/api/voters?campaignId=${campaignId}`)).json();
    expect(asMember.items.length).toBeGreaterThan(0);
    for (const v of asMember.items) expect(v._count).not.toHaveProperty("donations");

    const asOwner = await (await fetchAs(owner.cookie, `/api/voters?campaignId=${campaignId}`)).json();
    expect(asOwner.items[0]._count).toHaveProperty("donations");
  });

  test("members don't get fundraising totals from the dashboard", async () => {
    const res = await fetchAs(member.cookie, `/api/dashboard?campaignId=${campaignId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fundraising).toBeNull();
    expect(body.totals).not.toHaveProperty("raisedCents");
    expect(body.totals).not.toHaveProperty("donors");
    expect(body.totals).not.toHaveProperty("donations");
    expect(body.recentActivity.some((a: { kind: string }) => a.kind === "donation")).toBe(false);

    const asOwner = await (await fetchAs(owner.cookie, `/api/dashboard?campaignId=${campaignId}`)).json();
    expect(asOwner.fundraising).not.toBeNull();
    expect(asOwner.fundraising.donors).toBe(1);
    expect(asOwner.totals.teammates).toBe(2);
  });
});
