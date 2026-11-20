import { describe, expect, test } from "bun:test";
import { fetchAs, login, signupAndLogin, uniqueEmail } from "../helpers/client";
import { TEST_BASE_URL } from "../setup";
import { testDb } from "../helpers/testDb";

describe("POST /api/signup", () => {
  test("creates a new account with a blank campaign", async () => {
    const account = await signupAndLogin();

    const membershipsRes = await fetchAs(account.cookie, "/api/memberships");
    const memberships = await membershipsRes.json();

    expect(membershipsRes.status).toBe(200);
    expect(memberships.items).toHaveLength(1);
    expect(memberships.items[0].campaignId).toBe(account.campaignId);
    expect(memberships.items[0].role).toBe("owner");

    // A signup campaign is blank — no demo data.
    const votersRes = await fetchAs(account.cookie, `/api/voters?campaignId=${account.campaignId}`);
    const voters = await votersRes.json();
    expect(voters.total).toBe(0);
  });

  test("puts the owner on the volunteer roster, linked to their login", async () => {
    const account = await signupAndLogin({ name: "Rosa Maria Diaz" });
    const user = await testDb.user.findUniqueOrThrow({ where: { email: account.email } });

    const list = await (await fetchAs(account.cookie, `/api/volunteers?campaignId=${account.campaignId}`)).json();
    expect(list.items).toHaveLength(1);
    const [own] = list.items;
    expect(own.userId).toBe(user.id);
    expect(own.firstName).toBe("Rosa");
    expect(own.lastName).toBe("Maria Diaz");
    expect(own.email).toBe(account.email);

    // Linking again (the "Add yourself" path) returns the same entry, never a second one.
    const again = await fetchAs(account.cookie, "/api/volunteers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: account.campaignId, self: true }),
    });
    expect((await again.json()).id).toBe(own.id);
    expect(await testDb.volunteer.count({ where: { campaignId: account.campaignId } })).toBe(1);
  });

  test("rejects a duplicate email with 409", async () => {
    const email = uniqueEmail();
    const password = "correcthorsebatterystaple1";

    await signupAndLogin({ email, password });

    const res = await fetch(`${TEST_BASE_URL}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.1.2.3" },
      body: JSON.stringify({
        name: "Someone Else",
        email,
        password,
        candidateName: "X",
        officeSought: "Y",
        district: "Z",
        electionDate: "2026-11-03",
      }),
    });

    expect(res.status).toBe(409);
  });
});

describe("login", () => {
  test("wrong password is rejected", async () => {
    const account = await signupAndLogin();
    const badCookie = await login(account.email, "wrong-password-entirely");

    // No valid session cookie was ever set. src/proxy.ts's middleware
    // redirects any unauthenticated request (including API routes) to
    // /login before it ever reaches the route handler — so the correct
    // assertion here is a redirect, not a raw 401 (fetch follows redirects
    // by default, so disable that to see the real status).
    const res = await fetchAs(badCookie, "/api/memberships", { redirect: "manual" });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toContain("/login");
  });
});
