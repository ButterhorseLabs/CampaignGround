import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { fetchAs, signupAndLogin, uniqueEmail, type TestAccount } from "../helpers/client";
import { testDb } from "../helpers/testDb";

// The platform owner is whoever signed up first in this deployment, which
// another test file may already be. A fresh account is promoted directly so
// this file doesn't depend on test order; the flag is cleared afterwards.
async function signupPlatformOwner(): Promise<TestAccount> {
  const account = await signupAndLogin();
  await testDb.user.update({ where: { email: account.email }, data: { isPlatformOwner: true } });
  return account;
}

const STEP_FIELDS = ["signedUpAt", "firstVoterAt", "firstVolunteerAt", "firstInviteAt", "activatedAt"] as const;

interface FunnelRow {
  campaignId: string;
  campaignName: string;
  teamSize: number;
  signedUpAt: string;
  firstVoterAt: string | null;
  firstVolunteerAt: string | null;
  firstInviteAt: string | null;
  activatedAt: string | null;
}

interface Funnel {
  summary: {
    reached: Record<(typeof STEP_FIELDS)[number], number>;
    medianSignupToActivationMs: number | null;
  };
  items: FunnelRow[];
}

async function getFunnel(cookie: string): Promise<Funnel> {
  const res = await fetchAs(cookie, "/api/platform/funnel");
  expect(res.status).toBe(200);
  return res.json();
}

function rowFor(funnel: Funnel, campaignId: string): FunnelRow {
  const row = funnel.items.find((r) => r.campaignId === campaignId);
  if (!row) throw new Error(`campaign ${campaignId} missing from funnel`);
  return row;
}

async function postJson(cookie: string, path: string, body: unknown): Promise<Response> {
  const res = await fetchAs(cookie, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(200);
  return res;
}

// Asserts an ISO timestamp falls between two client-side instants, with a
// little slack for clock granularity between the test runner and Postgres.
function expectBetween(iso: string | null, from: number, to: number) {
  expect(iso).not.toBeNull();
  const t = new Date(iso!).getTime();
  expect(t).toBeGreaterThanOrEqual(from - 1000);
  expect(t).toBeLessThanOrEqual(to + 1000);
}

describe("activation funnel", () => {
  let platformOwner: TestAccount;

  beforeAll(async () => {
    platformOwner = await signupPlatformOwner();
  });

  afterAll(async () => {
    await testDb.user.update({ where: { email: platformOwner.email }, data: { isPlatformOwner: false } });
  });

  test("only the platform owner can see the funnel", async () => {
    const campaignOwner = await signupAndLogin();
    const res = await fetchAs(campaignOwner.cookie, "/api/platform/funnel");
    expect(res.status).toBe(403);
  });

  test("a campaign shows each setup step's time as it happens, through activation", async () => {
    const t0 = Date.now();
    const campaign = await signupAndLogin({ candidateName: "Funnel Candidate" });
    const t1 = Date.now();

    const voterRes = await postJson(campaign.cookie, "/api/voters", {
      campaignId: campaign.campaignId,
      firstName: "Pat",
      lastName: "Example",
      email: "pat.voter@example.com",
    });
    const voter = await voterRes.json();
    const t2 = Date.now();

    // The owner's own roster entry is not "a volunteer besides the owner".
    await postJson(campaign.cookie, "/api/volunteers", { campaignId: campaign.campaignId, self: true });
    let row = rowFor(await getFunnel(platformOwner.cookie), campaign.campaignId);
    expect(row.firstVolunteerAt).toBeNull();

    const t3 = Date.now();
    await postJson(campaign.cookie, "/api/volunteers", {
      campaignId: campaign.campaignId,
      firstName: "Robin",
      lastName: "Helper",
    });
    const t4 = Date.now();

    row = rowFor(await getFunnel(platformOwner.cookie), campaign.campaignId);
    expect(row.campaignName).toBe("Funnel Candidate");
    expect(row.teamSize).toBe(1);
    expectBetween(row.signedUpAt, t0, t1);
    expectBetween(row.firstVoterAt, t1, t2);
    expectBetween(row.firstVolunteerAt, t3, t4);
    expect(row.firstInviteAt).toBeNull();
    expect(row.activatedAt).toBeNull();

    // Setup progress only: nothing from the campaign's voter or volunteer records.
    expect(Object.keys(row).sort()).toEqual(
      ["campaignId", "campaignName", "teamSize", ...STEP_FIELDS].sort()
    );
    const raw = JSON.stringify(await getFunnel(platformOwner.cookie));
    expect(raw).not.toContain("pat.voter@example.com");
    expect(raw).not.toContain("Robin");

    const t5 = Date.now();
    await postJson(campaign.cookie, "/api/invites", {
      campaignId: campaign.campaignId,
      email: uniqueEmail("invitee"),
    });
    const t6 = Date.now();
    await postJson(campaign.cookie, "/api/canvass", {
      campaignId: campaign.campaignId,
      voterId: voter.id,
      outcome: "not-home",
    });
    const t7 = Date.now();

    row = rowFor(await getFunnel(platformOwner.cookie), campaign.campaignId);
    expectBetween(row.firstInviteAt, t5, t6);
    expectBetween(row.activatedAt, t6, t7);
  });

  test("a logged call also activates a campaign", async () => {
    const campaign = await signupAndLogin();
    const voter = await (
      await postJson(campaign.cookie, "/api/voters", {
        campaignId: campaign.campaignId,
        firstName: "Lee",
        lastName: "Caller",
      })
    ).json();
    const before = Date.now();
    await postJson(campaign.cookie, "/api/calls", {
      campaignId: campaign.campaignId,
      voterId: voter.id,
      outcome: "no-answer",
    });
    const row = rowFor(await getFunnel(platformOwner.cookie), campaign.campaignId);
    expectBetween(row.activatedAt, before, Date.now());
  });

  test("summary counts match the per-campaign rows", async () => {
    const funnel = await getFunnel(platformOwner.cookie);
    expect(funnel.items.length).toBeGreaterThan(0);
    for (const step of STEP_FIELDS) {
      expect(funnel.summary.reached[step]).toBe(funnel.items.filter((r) => r[step] !== null).length);
    }
    // Earlier tests in this file activated at least one campaign.
    expect(funnel.summary.medianSignupToActivationMs).toBeGreaterThan(0);
  });
});
