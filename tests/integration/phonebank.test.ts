import { beforeAll, describe, expect, test } from "bun:test";
import { fetchAs, signupAndLogin, type TestAccount } from "../helpers/client";
import { testDb } from "../helpers/testDb";

let owner: TestAccount;
let outsider: TestAccount;
let campaignId: string;
const ids: Record<string, string> = {};

const json = { "Content-Type": "application/json" };
const queue = async (cookie = owner.cookie) =>
  (await fetchAs(cookie, `/api/calls/queue?campaignId=${campaignId}`)).json();

beforeAll(async () => {
  [owner, outsider] = await Promise.all([
    signupAndLogin({ name: "Call Owner" }),
    signupAndLogin({ name: "Call Outsider" }),
  ]);
  campaignId = owner.campaignId;

  const voter = (firstName: string, supportLevel: string, phone: string | null = "555-0100") =>
    testDb.voter.create({ data: { campaignId, firstName, lastName: "Caller", supportLevel, phone } }).then((v) => (ids[firstName] = v.id));
  await Promise.all([
    voter("Fresh", "undecided"),
    voter("Recent", "undecided"),
    voter("Stale", "lean-support"),
    voter("Wrong", "unknown"),
    voter("Reached", "undecided"),
    voter("Decided", "strong-support"),
    voter("NoPhone", "undecided", null),
  ]);
  const log = (name: string, outcome: string, hoursAgo: number) =>
    testDb.callLog.create({
      data: { campaignId, voterId: ids[name], outcome, calledAt: new Date(Date.now() - hoursAgo * 3_600_000) },
    });
  await Promise.all([
    log("Recent", "no-answer", 2),
    log("Stale", "voicemail", 30),
    log("Wrong", "wrong-number", 100),
    log("Reached", "contacted", 100),
  ]);
});

describe("GET /api/calls/queue", () => {
  test("skips reached, refused-style and recently tried voters, never-called first", async () => {
    const body = await queue();
    expect(body.items.map((v: { firstName: string }) => v.firstName)).toEqual(["Fresh", "Stale"]);
    expect(body.remaining).toBe(2);
    expect(body.items[1].lastOutcome).toBe("voicemail");
  });

  test("carries the campaign facts the script quotes", async () => {
    const body = await queue();
    expect(Object.keys(body.campaign).sort()).toEqual(["candidateName", "district", "electionDate", "officeSought"]);
  });

  test("refuses someone outside the campaign", async () => {
    const res = await fetchAs(outsider.cookie, `/api/calls/queue?campaignId=${campaignId}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("call totals and undo", () => {
  test("totals cover the whole campaign whatever the log filter", async () => {
    const body = await (await fetchAs(owner.cookie, `/api/calls?campaignId=${campaignId}&outcome=refused`)).json();
    expect(body.items).toEqual([]);
    expect(body.summary).toEqual({ calls: 4, contacted: 1, noAnswer: 1, avgLengthSec: 0 });
  });

  test("undoing a call puts the voter back in the queue; a call that set support can't be undone", async () => {
    const post = async (body: Record<string, unknown>) =>
      (await fetchAs(owner.cookie, "/api/calls", { method: "POST", headers: json, body: JSON.stringify({ campaignId, ...body }) })).json();
    const del = (cookie: string, id: string) => fetchAs(cookie, `/api/calls?campaignId=${campaignId}&id=${id}`, { method: "DELETE" });

    const noAnswer = await post({ voterId: ids.Fresh, outcome: "no-answer", callLengthSec: 20 });
    expect((await queue()).items.map((v: { firstName: string }) => v.firstName)).toEqual(["Stale"]);
    expect((await del(outsider.cookie, noAnswer.id)).status).toBeGreaterThanOrEqual(400);
    expect((await del(owner.cookie, noAnswer.id)).status).toBe(200);
    expect((await queue()).items.map((v: { firstName: string }) => v.firstName)).toEqual(["Fresh", "Stale"]);

    const withSupport = await post({ voterId: ids.Stale, outcome: "contacted", supportLevel: "lean-support" });
    expect((await del(owner.cookie, withSupport.id)).status).toBe(409);
  });
});
