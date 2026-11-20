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

  test("a voter's donation count comes from the donor linked to that voter", async () => {
    const voter = await testDb.voter.findFirstOrThrow({ where: { campaignId, lastName: "Member-Added" } });
    const donor = await testDb.donor.findFirstOrThrow({ where: { campaignId, lastName: "Giver" } });
    // No API route links a donor to a voter yet; set the link directly.
    await testDb.donor.update({ where: { id: donor.id }, data: { voterId: voter.id } });
    for (const amountCents of [2500, 5000]) {
      const res = await post(owner.cookie, "/api/donations", { campaignId, donorId: donor.id, amountCents });
      expect(res.status).toBe(200);
    }

    const list = await (await fetchAs(owner.cookie, `/api/voters?campaignId=${campaignId}&limit=200`)).json();
    const linked = list.items.find((v: { id: string }) => v.id === voter.id);
    expect(linked._count.donations).toBe(2);
    const others = list.items.filter((v: { id: string }) => v.id !== voter.id);
    for (const v of others) expect(v._count.donations).toBe(0);
  });
});

describe("correcting and deleting a voter", () => {
  function send(cookie: string, method: "PATCH" | "DELETE", body: unknown) {
    return fetchAs(cookie, "/api/voters", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function addVoter(fields: Record<string, string>) {
    const res = await post(owner.cookie, "/api/voters", { campaignId, ...fields });
    expect(res.status).toBe(200);
    return (await res.json()) as { id: string };
  }

  async function findVoter(q: string) {
    const list = await (await fetchAs(owner.cookie, `/api/voters?campaignId=${campaignId}&q=${encodeURIComponent(q)}`)).json();
    return list.items as Array<Record<string, unknown>>;
  }

  test("a member can correct a voter's name, phone, email and address", async () => {
    const voter = await addVoter({ firstName: "Jon", lastName: "Typo", phone: "555-0000", registeredAddress: "4 Pine St" });

    const res = await send(member.cookie, "PATCH", {
      id: voter.id,
      firstName: "John",
      lastName: "Corrected",
      phone: "555-0199",
      email: "john@example.com",
      registeredAddress: "44 Pine St",
    });
    expect(res.status).toBe(200);

    const [found] = await findVoter("Corrected");
    expect(found).toMatchObject({
      id: voter.id,
      firstName: "John",
      lastName: "Corrected",
      phone: "555-0199",
      email: "john@example.com",
      registeredAddress: "44 Pine St",
    });

    // Clearing an optional field stores nothing rather than an empty string.
    expect((await send(member.cookie, "PATCH", { id: voter.id, email: "" })).status).toBe(200);
    expect((await findVoter("Corrected"))[0].email).toBeNull();
  });

  test("a voter's name can't be blanked", async () => {
    const voter = await addVoter({ firstName: "Nora", lastName: "Named" });
    expect((await send(member.cookie, "PATCH", { id: voter.id, firstName: "  " })).status).toBe(400);
    expect((await send(member.cookie, "PATCH", { id: voter.id, lastName: "" })).status).toBe(400);
    expect((await findVoter("Named"))[0].firstName).toBe("Nora");
  });

  test("moving an imported voter to a new street address takes them out of their old household", async () => {
    const imported = await post(owner.cookie, "/api/voters/import", {
      campaignId,
      rows: [{ firstName: "Hal", lastName: "Mover", address: "7 Old Rd", zip: "97001" }],
    });
    expect(imported.status).toBe(200);
    const [before] = await findVoter("Mover");
    expect(before.household).toMatchObject({ address: "7 Old Rd" });

    expect((await send(member.cookie, "PATCH", { id: before.id, registeredAddress: "9 New Rd" })).status).toBe(200);
    const [after] = await findVoter("Mover");
    expect(after.registeredAddress).toBe("9 New Rd");
    expect(after.household).toBeNull();
  });

  test("renaming a voter onto another voter at the same address is refused", async () => {
    await addVoter({ firstName: "Ann", lastName: "Twin", registeredAddress: "1 Oak St" });
    const other = await addVoter({ firstName: "Bea", lastName: "Twin", registeredAddress: "1 Oak St" });

    const res = await send(member.cookie, "PATCH", { id: other.id, firstName: "ann" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("ann Twin at this address is already on your voter list.");

    // Moving onto that person's address is the same clash.
    const third = await addVoter({ firstName: "Ann", lastName: "Twin", registeredAddress: "2 Oak St" });
    expect((await send(member.cookie, "PATCH", { id: third.id, registeredAddress: "1 OAK ST" })).status).toBe(409);

    // Saving a voter's own unchanged name and address isn't a clash with themselves.
    expect((await send(member.cookie, "PATCH", { id: other.id, firstName: "Bea", phone: "555-0123" })).status).toBe(200);
  });

  test("only owners can delete a voter, and deleting releases their claim", async () => {
    const voter = await addVoter({ firstName: "Del", lastName: "Etable" });

    expect((await send(member.cookie, "DELETE", { id: voter.id })).status).toBe(403);
    expect(await findVoter("Etable")).toHaveLength(1);

    const volunteer = await (await post(owner.cookie, "/api/volunteers", { campaignId, firstName: "Cal", lastName: "Claimer" })).json();
    const claim = await post(owner.cookie, "/api/claims", { voterId: voter.id, channel: "call", volunteerId: volunteer.id });
    expect(claim.status).toBe(200);

    expect((await send(owner.cookie, "DELETE", { id: voter.id })).status).toBe(200);
    expect(await findVoter("Etable")).toHaveLength(0);
    const claims = await (await fetchAs(owner.cookie, `/api/claims?channel=call&campaignId=${campaignId}`)).json();
    expect(claims.items.map((c: { voterId: string }) => c.voterId)).not.toContain(voter.id);
  });

  test("a voter with call or door-knock history can't be deleted, so outreach counts don't change", async () => {
    const voter = await addVoter({ firstName: "Hist", lastName: "Ory" });
    const call = await post(owner.cookie, "/api/calls", { campaignId, voterId: voter.id, outcome: "contacted" });
    expect(call.status).toBe(200);
    const dashboard = async () => (await (await fetchAs(owner.cookie, `/api/dashboard?campaignId=${campaignId}`)).json()).totals;
    const before = await dashboard();

    const res = await send(owner.cookie, "DELETE", { id: voter.id });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("Hist Ory has call or door-knock history");
    expect(await findVoter("Ory")).toHaveLength(1);
    expect(await dashboard()).toEqual(before);
  });
});
