import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/api-validate";
import { passwordResetConfirmSchema } from "@/lib/validation/password-reset";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const INVALID = "This reset link has expired or was already used. Request a new one.";

// POST /api/password-reset/confirm — public. Sets a new password from a
// one-time emailed token, then burns every outstanding token for the user.
export async function POST(req: NextRequest) {
  const ip = getClientIp(await headers());
  if (!checkRateLimit(`password-reset-confirm:${ip}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = await parseBody(req, passwordResetConfirmSchema);
  if ("error" in parsed) return parsed.error;
  const { token, password } = parsed.data;

  const tokenHash = createHash("sha256").update(token).digest("hex");
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

  if (!updated) return NextResponse.json({ error: INVALID }, { status: 400 });
  return NextResponse.json({ ok: true });
}
