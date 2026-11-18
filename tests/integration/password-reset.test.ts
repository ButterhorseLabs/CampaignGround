import { describe, expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import { fetchAs, login, signupAndLogin, uniqueEmail } from "../helpers/client";
import { TEST_BASE_URL } from "../setup";
import { testDb } from "../helpers/testDb";

function uniqueIp(): string {
  const octet = () => Math.floor(Math.random() * 255);
  return `10.${octet()}.${octet()}.${octet()}`;
}

function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${TEST_BASE_URL}${path}`, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": uniqueIp() },
    body: JSON.stringify(body),
  });
}

async function sessionEmail(cookie: string): Promise<string | undefined> {
  const res = await fetchAs(cookie, "/api/auth/session");
  const body = await res.json();
  return body?.user?.email;
}

async function insertToken(userId: string, expiresAt: Date) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await testDb.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  return token;
}

describe("password reset", () => {
  test("unknown and known emails get the same response; only a hash is stored", async () => {
    const unknown = await post("/api/password-reset/request", { email: uniqueEmail("nobody") });
    const account = await signupAndLogin();
    const known = await post("/api/password-reset/request", { email: account.email });

    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());

    const user = await testDb.user.findUniqueOrThrow({ where: { email: account.email } });
    const live = await testDb.passwordResetToken.findMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(live).toHaveLength(1);
    expect(live[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a second request leaves exactly one live token", async () => {
    const account = await signupAndLogin();
    await post("/api/password-reset/request", { email: account.email });
    await post("/api/password-reset/request", { email: account.email });
    const user = await testDb.user.findUniqueOrThrow({ where: { email: account.email } });
    const live = await testDb.passwordResetToken.count({ where: { userId: user.id, usedAt: null } });
    expect(live).toBe(1);
  });

  test("confirm sets the new password and the token cannot be reused", async () => {
    const account = await signupAndLogin();
    const user = await testDb.user.findUniqueOrThrow({ where: { email: account.email } });
    const token = await insertToken(user.id, new Date(Date.now() + 60 * 60_000));
    const other = await insertToken(user.id, new Date(Date.now() + 60 * 60_000));
    const newPassword = "a brand new passphrase 42";

    const res = await post("/api/password-reset/confirm", { token, password: newPassword });
    expect(res.status).toBe(200);

    expect(await sessionEmail(await login(account.email, account.password))).toBeUndefined();
    expect(await sessionEmail(await login(account.email, newPassword))).toBe(account.email);

    const reused = await post("/api/password-reset/confirm", { token, password: "another passphrase 99" });
    expect(reused.status).toBe(400);
    expect((await reused.json()).error).toBe(
      "This reset link has expired or was already used. Request a new one."
    );
    const sibling = await post("/api/password-reset/confirm", { token: other, password: "another passphrase 99" });
    expect(sibling.status).toBe(400);
  });

  test("expired token is rejected and short passwords get a field issue", async () => {
    const account = await signupAndLogin();
    const user = await testDb.user.findUniqueOrThrow({ where: { email: account.email } });
    const expired = await insertToken(user.id, new Date(Date.now() - 1000));
    const res = await post("/api/password-reset/confirm", { token: expired, password: "long enough passphrase" });
    expect(res.status).toBe(400);

    const live = await insertToken(user.id, new Date(Date.now() + 60 * 60_000));
    const short = await post("/api/password-reset/confirm", { token: live, password: "short" });
    expect(short.status).toBe(400);
    expect((await short.json()).issues[0].path).toBe("password");
  });
});

describe("signup capacity", () => {
  test("GET /api/signup reports open by default", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/signup`, { credentials: "omit" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ open: true });
  });
});
