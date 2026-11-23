import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/api-validate";
import { passwordResetConfirmSchema } from "@/lib/validation/password-reset";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit"

const INVALID = "This reset link has expired or was already used. Request a new one.";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// GET /api/password-reset/confirm?token= — public. Lets the reset page say a
// link is dead before anyone types a new password. Only a boolean comes back.
export async function GET(req: NextRequest) {
  const ip = getClientIp(await headers());
  if (!checkRateLimit(`password-reset-confirm:${ip}`, { max: 10, windowMs: 60_000 })) {
    return tooManyRequests();
  }
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const live = await db.passwordResetToken.count({
    where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
  });
  return NextResponse.json({ valid: live === 1 });
}

// POST /api/password-reset/confirm — public. Sets a new password from a
// one-time emailed token, then burns every outstanding token for the user.
export async function POST(req: NextRequest) {
  const ip = getClientIp(await headers());
  if (!checkRateLimit(`password-reset-confirm:${ip}`, { max: 10, windowMs: 60_000 })) {
    return tooManyRequests();
  }

  const parsed = await parseBody(req, passwordResetConfirmSchema);
  if ("error" in parsed) return parsed.error;
  const { token, password } = parsed.data;

  const tokenHash = hashToken(token);
  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    // Conditional claim: only one concurrent request can mark it used.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;
    const { userId } = await tx.passwordResetToken.findUniqueOrThrow({ where: { tokenHash } });
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    return true;
  });

  if (!updated) return NextResponse.json({ error: INVALID, expired: true }, { status: 400 });
  return NextResponse.json({ ok: true });
}
