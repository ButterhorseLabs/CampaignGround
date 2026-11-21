import { beforeAll, describe, expect, test } from "bun:test";
import { fetchAs, signupAndLogin, type TestAccount } from "../helpers/client";
import { testDb } from "../helpers/testDb";

let owner: TestAccount;
let outsider: TestAccount;
let campaignId: string;
let precinctId: string;

interface DoorBody {
  id: string;
  address: string | null;
  voters: { id: string; firstName: string; campaignId: string; household: { address: string } | null }[];
}

beforeAll(async () => {
  [owner, outsider] = await Promise.all([
    signupAndLogin({ name: "Walk Owner" }),
    signupAndLogin({ name: "Walk Outsider" }),
  ]);
  campaignId = owner.campaignId;

  precinctId = (await testDb.precinct.create({ data: { campaignId, name: "North 1", code: "N1" } })).id;
  // A precinct with no voters has no walk list.
  await testDb.precinct.create({ data: { campaignId, name: "Empty 9", code: "E9" } });

  const household = (address: string) =>
    testDb.household.create({ data: { campaignId, address, city: "Springfield", state: "IL", zip: "62701" } });
  const [elm10, elm2, oak1] = await Promise.all([household("10 Elm St"), household("2 Elm St"), household("1 Oak Ave")]);

  const voter = (firstName: string, householdId: string | null, pId: string | null, registeredAddress?: string) =>
    testDb.voter.create({
      data: { campaignId, firstName, lastName: "Walker", householdId, precinctId: pId, registeredAddress },
    });
  await Promise.all([
    voter("Ten", elm10.id, precinctId),
    voter("TwoA", elm2.id, precinctId),
    voter("TwoB", elm2.id, precinctId),
    voter("Oak", oak1.id, precinctId),
    voter("Nowhere", null, null, "7 Pine Rd"),
  ]);
  // Another campaign's voters never show up here.
  await testDb.voter.create({
    data: { campaignId: outsider.campaignId, firstName: "Other", lastName: "Campaign", precinctId: null },
  });
});

describe("GET /api/walk-lists", () => {
  test("lists every precinct with voters, sized in doors, plus No precinct under the id its doors are fetched by", async () => {
    const res = await fetchAs(owner.cookie, `/api/walk-lists?campaignId=${campaignId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([
      { precinctId, name: "North 1", doorCount: 3 },
      { precinctId: "none", name: "No precinct", doorCount: 1 },
    ]);
  });

  test("refuses someone outside the campaign", async () => {
    const res = await fetchAs(outsider.cookie, `/api/walk-lists?campaignId=${campaignId}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("GET /api/walk-lists/doors", () => {
  const doors = (cookie: string, query: string) => fetchAs(cookie, `/api/walk-lists/doors?campaignId=${campaignId}&${query}`);

  test("pages doors in street then house-number order with housemates together", async () => {
    const first = await doors(owner.cookie, `precinctId=${precinctId}&limit=2&offset=0`);
    expect(first.status).toBe(200);
    const page1 = await first.json();
    expect(page1.total).toBe(3);
    expect(page1.items.map((d: DoorBody) => d.address)).toEqual(["2 Elm St", "10 Elm St"]);
    expect(page1.items[0].voters.map((v: DoorBody["voters"][number]) => v.firstName).sort()).toEqual(["TwoA", "TwoB"]);
    // The log dialog needs these to save an attempt for the claimed voter.
    expect(page1.items[0].voters[0].campaignId).toBe(campaignId);

    const page2 = await (await doors(owner.cookie, `precinctId=${precinctId}&limit=2&offset=2`)).json();
    expect(page2.items.map((d: DoorBody) => d.address)).toEqual(["1 Oak Ave"]);
  });

  test("serves voters without a precinct as the No precinct walk list", async () => {
    const body = await (await doors(owner.cookie, "precinctId=none")).json();
    expect(body.total).toBe(1);
    expect(body.items[0].address).toBe("7 Pine Rd");
    expect(body.items[0].voters.map((v: DoorBody["voters"][number]) => v.firstName)).toEqual(["Nowhere"]);
  });

  test("requires a precinct and refuses someone outside the campaign", async () => {
    expect((await doors(owner.cookie, "")).status).toBe(400);
    expect((await doors(outsider.cookie, `precinctId=${precinctId}`)).status).toBeGreaterThanOrEqual(400);
  });
});

describe("visits on the walk list", () => {
  const post = (body: Record<string, unknown>) =>
    fetchAs(owner.cookie, "/api/canvass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, ...body }),
    });
  let notHomeId: string;
  let contactedId: string;

  beforeAll(async () => {
    const elm2 = await testDb.household.findFirstOrThrow({ where: { campaignId, address: "2 Elm St" } });
    const oak = await testDb.voter.findFirstOrThrow({ where: { campaignId, firstName: "Oak" } });
    // "Nobody home" logs the household, not one resident.
    const a = await post({ householdId: elm2.id, outcome: "not-home" });
    const b = await post({ voterId: oak.id, householdId: oak.householdId, outcome: "contacted", supportLevel: "lean-support" });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    notHomeId = (await a.json()).id;
    contactedId = (await b.json()).id;
  });

  test("each door carries its latest visit, and only answered doors count as done", async () => {
    const res = await fetchAs(owner.cookie, `/api/walk-lists/doors?campaignId=${campaignId}&precinctId=${precinctId}`);
    const body = await res.json();
    const byAddress = Object.fromEntries(body.items.map((d: DoorBody & { lastVisit: { outcome: string } | null }) => [d.address, d.lastVisit?.outcome ?? null]));
    expect(byAddress).toEqual({ "2 Elm St": "not-home", "10 Elm St": null, "1 Oak Ave": "contacted" });
    expect(body.done).toBe(1);
  });

  test("canvass totals cover the whole campaign whatever the log filter", async () => {
    const body = await (await fetchAs(owner.cookie, `/api/canvass?campaignId=${campaignId}&outcome=refused`)).json();
    expect(body.items).toEqual([]);
    expect(body.summary).toEqual({ attempts: 2, doors: 2, contacted: 1, notHome: 1, yardSigns: 0 });
  });

  test("undo removes a plain visit but not one that changed the voter record", async () => {
    const del = (cookie: string, id: string) => fetchAs(cookie, `/api/canvass?campaignId=${campaignId}&id=${id}`, { method: "DELETE" });
    expect((await del(outsider.cookie, notHomeId)).status).toBeGreaterThanOrEqual(400);
    expect((await del(owner.cookie, contactedId)).status).toBe(409);
    expect((await del(owner.cookie, notHomeId)).status).toBe(200);
    expect(await testDb.canvassLog.findUnique({ where: { id: notHomeId } })).toBeNull();
  });
});
