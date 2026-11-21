import { beforeAll, describe, expect, test } from "bun:test";
import { fetchAs, login, signupAndLogin, uniqueEmail, type TestAccount } from "../helpers/client";
import { TEST_BASE_URL } from "../setup";
import { testDb } from "../helpers/testDb";

let owner: TestAccount;
let memberCookie: string;
let campaignId: string;
let memberVolunteerId: string;
let otherVolunteerId: string;
let voterA: string; // housemates
let voterB: string;
let voterSolo: string;

const json = { "Content-Type": "application/json" };

function claimReq(cookie: string, method: "POST" | "DELETE", voterId: string, volunteerId: string, channel = "canvass") {
  return fetchAs(cookie, "/api/claims", {
    method,
    headers: json,
    body: JSON.stringify({ voterId, channel, volunteerId }),
  });
}

beforeAll(async () => {
  owner = await signupAndLogin({ name: "Claims Owner" });
  campaignId = owner.campaignId;

  const memberEmail = uniqueEmail("claims-member");
  const inviteRes = await fetchAs(owner.cookie, "/api/invites", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ campaignId, email: memberEmail }),
  });
  expect(inviteRes.status).toBe(200);
  const invite = await testDb.invite.findUniqueOrThrow({
    where: { campaignId_email: { campaignId, email: memberEmail } },
  });
  const acceptRes = await fetch(`${TEST_BASE_URL}/api/invites/token/${invite.token}/accept`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ name: "Riley Member Jones", password: "correcthorsebatterystaple1" }),
  });
  expect(acceptRes.status).toBe(200);
  memberCookie = await login(memberEmail, "correcthorsebatterystaple1");

  const memberUser = await testDb.user.findUniqueOrThrow({ where: { email: memberEmail } });
  memberVolunteerId = (await testDb.volunteer.findFirstOrThrow({ where: { campaignId, userId: memberUser.id } })).id;
  otherVolunteerId = (
    await testDb.volunteer.create({ data: { campaignId, firstName: "Other", lastName: "Volunteer" } })
  ).id;

  const household = await testDb.household.create({
    data: { campaignId, address: "12 Elm St", city: "Springfield", state: "IL", zip: "62701" },
  });
  const mk = (firstName: string, householdId?: string) =>
    testDb.voter.create({ data: { campaignId, firstName, lastName: "Voter", householdId } }).then((v) => v.id);
  [voterA, voterB, voterSolo] = await Promise.all([mk("A", household.id), mk("B", household.id), mk("Solo")]);
});

describe("invite acceptance", () => {
  test("creates a linked volunteer with the name split from the account", async () => {
    const v = await testDb.volunteer.findUniqueOrThrow({ where: { id: memberVolunteerId } });
    expect(v.firstName).toBe("Riley");
    expect(v.lastName).toBe("Member Jones");
    expect(v.email).toContain("claims-member");
  });
});

describe("household canvass claims", () => {
  test("a claim on one housemate blocks another volunteer's claim on the other", async () => {
    expect((await claimReq(owner.cookie, "POST", voterA, otherVolunteerId)).status).toBe(200);

    const res = await claimReq(memberCookie, "POST", voterB, memberVolunteerId);
    expect(res.status).toBe(409);
    expect((await res.json()).claimedBy).toBe("Other Volunteer");
  });

  test("GET expands the claim to every housemate", async () => {
    const res = await fetchAs(memberCookie, `/api/claims?channel=canvass&campaignId=${campaignId}`);
    const { items } = await res.json();
    const byVoter = new Map(items.map((c: { voterId: string; volunteerId: string }) => [c.voterId, c.volunteerId]));
    expect(byVoter.get(voterA)).toBe(otherVolunteerId);
    expect(byVoter.get(voterB)).toBe(otherVolunteerId);
    expect(byVoter.has(voterSolo)).toBe(false);
  });

  test("calls stay per voter", async () => {
    expect((await claimReq(owner.cookie, "POST", voterA, otherVolunteerId, "call")).status).toBe(200);
    expect((await claimReq(memberCookie, "POST", voterB, memberVolunteerId, "call")).status).toBe(200);
  });

  test("the holder's re-POST succeeds and refreshes claimedAt", async () => {
    // Age the claim to 4 minutes (inside the 5 minute TTL) instead of waiting.
    const before = await testDb.contactClaim.update({
      where: { voterId_channel: { voterId: voterA, channel: "canvass" } },
      data: { claimedAt: new Date(Date.now() - 4 * 60_000) },
    });
    expect((await claimReq(owner.cookie, "POST", voterA, otherVolunteerId)).status).toBe(200);
    const after = await testDb.contactClaim.findUniqueOrThrow({
      where: { voterId_channel: { voterId: voterA, channel: "canvass" } },
    });
    expect(after.claimedAt.getTime()).toBeGreaterThan(before.claimedAt.getTime());
  });

  test("releasing the household frees the housemate", async () => {
    expect((await claimReq(owner.cookie, "DELETE", voterA, otherVolunteerId)).status).toBe(200);
    expect((await claimReq(memberCookie, "POST", voterB, memberVolunteerId)).status).toBe(200);
    expect((await claimReq(memberCookie, "DELETE", voterB, memberVolunteerId)).status).toBe(200);
  });
});

describe("acting as a volunteer", () => {
  test("a member cannot claim or log as a teammate", async () => {
    expect((await claimReq(memberCookie, "POST", voterSolo, otherVolunteerId)).status).toBe(403);
    const log = await fetchAs(memberCookie, "/api/canvass", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ campaignId, voterId: voterSolo, volunteerId: otherVolunteerId, outcome: "not-home" }),
    });
    expect(log.status).toBe(403);
    const call = await fetchAs(memberCookie, "/api/calls", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ campaignId, voterId: voterSolo, volunteerId: otherVolunteerId, outcome: "no-answer" }),
    });
    expect(call.status).toBe(403);
  });

  test("a member can claim and log as their own linked volunteer", async () => {
    expect((await claimReq(memberCookie, "POST", voterSolo, memberVolunteerId)).status).toBe(200);
    const log = await fetchAs(memberCookie, "/api/canvass", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ campaignId, voterId: voterSolo, volunteerId: memberVolunteerId, outcome: "not-home" }),
    });
    expect(log.status).toBe(200);
    expect((await claimReq(memberCookie, "DELETE", voterSolo, memberVolunteerId)).status).toBe(200);
  });

  test("an owner can act as any volunteer", async () => {
    expect((await claimReq(owner.cookie, "POST", voterSolo, memberVolunteerId)).status).toBe(200);
    const log = await fetchAs(owner.cookie, "/api/canvass", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ campaignId, voterId: voterSolo, volunteerId: memberVolunteerId, outcome: "not-home" }),
    });
    expect(log.status).toBe(200);
    expect((await claimReq(owner.cookie, "DELETE", voterSolo, memberVolunteerId)).status).toBe(200);
  });
});

describe("undoing a visit", () => {
  test("a member can undo their own visit but not a teammate's", async () => {
    const logAs = async (cookie: string, volunteerId: string) => {
      const res = await fetchAs(cookie, "/api/canvass", {
        method: "POST",
        headers: json,
        body: JSON.stringify({ campaignId, voterId: voterSolo, volunteerId, outcome: "not-home" }),
      });
      return (await res.json()).id as string;
    };
    const undo = (id: string) => fetchAs(memberCookie, `/api/canvass?campaignId=${campaignId}&id=${id}`, { method: "DELETE" });
    expect((await undo(await logAs(owner.cookie, otherVolunteerId))).status).toBe(403);
    expect((await undo(await logAs(memberCookie, memberVolunteerId))).status).toBe(200);
  });
});
