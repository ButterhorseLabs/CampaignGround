import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/api-validate";
import { passwordResetRequestSchema } from "@/lib/validation/password-reset";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

const TOKEN_TTL_MS = 60 * 60 * 1000;

// POST /api/password-reset/request — public. Always answers the same way so
// the response never reveals whether an account exists for the email.
export async function POST(req: NextRequest) {
  const ip = getClientIp(await headers());
  if (!checkRateLimit(`password-reset:${ip}`, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseBody(req, passwordResetRequestSchema);
  if ("error" in parsed) return parsed.error;
  const { email } = parsed.data;
  const ok = NextResponse.json({ ok: true });

  // Per-email cap stops one inbox being flooded; silent so it can't be used
  // to probe for accounts either.
  if (!checkRateLimit(`password-reset-email:${email.toLowerCase()}`, { max: 3, windowMs: 60 * 60_000 })) {
    return ok;
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return ok;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  await db.$transaction([
    db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
    db.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(now.getTime() + TOKEN_TTL_MS) },
    }),
  ]);

  // Not awaited: send latency would otherwise reveal that the account exists.
  // Same response either way; a send failure must not reveal the account.
  sendPasswordResetEmail({ to: user.email, token }).catch((err) =>
    console.error("password reset email failed:", err)
  );
  return ok;
}
