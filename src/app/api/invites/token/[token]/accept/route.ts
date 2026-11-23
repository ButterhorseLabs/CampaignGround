import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/api-validate";
import { acceptInviteNewUserSchema } from "@/lib/validation/invite";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { linkOwnVolunteer } from "@/lib/own-volunteer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const ip = getClientIp(await headers());
  if (!checkRateLimit(`invite-accept:${ip}`, { max: 10, windowMs: 60_000 })) {
    return tooManyRequests();
  }

  const { token } = await params;
  const invite = await db.invite.findUnique({ where: { token } });
  if (!invite) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (invite.status === "pending" && invite.expiresAt < new Date()) {
    await db.invite.update({ where: { id: invite.id }, data: { status: "expired" } });
    return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "This invite is no longer valid" }, { status: 410 });
  }

  const session = await getServerSession(authOptions);

  let userId: string;

  if (session?.user?.id && session.user.email === invite.email) {
    userId = session.user.id;
  } else {
    const existing = await db.user.findUnique({ where: { email: invite.email } });
    if (existing) {
      return NextResponse.json({ requiresLogin: true }, { status: 409 });
    }

    const parsed = await parseBody(req, acceptInviteNewUserSchema);
    if ("error" in parsed) return parsed.error;
    const { name, password } = parsed.data;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: { email: invite.email, passwordHash, name },
    });
    userId = user.id;
  }

  await db.$transaction([
    db.campaignMembership.upsert({
      where: { userId_campaignId: { userId, campaignId: invite.campaignId } },
      create: { userId, campaignId: invite.campaignId, role: "member" },
      update: {},
    }),
    db.invite.update({
      where: { id: invite.id },
      data: { status: "accepted", acceptedAt: new Date() },
    }),
  ]);

  // Joining the campaign also puts the new member on the volunteer roster,
  // linked to their login, so they can canvass and call as themselves. The
  // invite proves ownership of the email, so a roster entry the team already
  // added for this person is adopted instead of duplicated.
  await linkOwnVolunteer(invite.campaignId, userId);

  return NextResponse.json({ ok: true });
}
