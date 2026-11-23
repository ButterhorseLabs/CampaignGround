import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { parseBody } from "@/lib/api-validate";
import { signupSchema } from "@/lib/validation/signup";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit"
import { linkOwnVolunteer } from "@/lib/own-volunteer";

// MAX_USERS caps self-service signups on this server; unset means unlimited.
async function signupsOpen(): Promise<boolean> {
  const maxUsers = process.env.MAX_USERS ? parseInt(process.env.MAX_USERS, 10) : null;
  if (maxUsers === null || Number.isNaN(maxUsers)) return true;
  return (await db.user.count()) < maxUsers;
}

// GET /api/signup — public. Lets the signup page announce closed signups
// before the form; only a boolean, never the user count.
export async function GET() {
  return NextResponse.json({ open: await signupsOpen() });
}

// POST /api/signup — public, open self-service signup. Creates a brand-new
// User plus a blank Campaign (no demo data) with that user as owner and as
// the campaign's first volunteer.
export async function POST(req: NextRequest) {
  const ip = getClientIp(await headers());
  if (!checkRateLimit(`signup:${ip}`, { max: 5, windowMs: 60_000 })) {
    return tooManyRequests();
  }

  if (!(await signupsOpen())) {
    return NextResponse.json({ error: "Signups are currently closed" }, { status: 403 });
  }

  const parsed = await parseBody(req, signupSchema);
  if ("error" in parsed) return parsed.error;
  const { name, email, password, candidateName, officeSought, district, party, electionDate } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.$transaction(async (tx) => {
    const isFirstUser = (await tx.user.count()) === 0;
    const user = await tx.user.create({ data: { email, passwordHash, name, isPlatformOwner: isFirstUser } });
    const campaign = await tx.campaign.create({
      data: {
        candidateName,
        officeSought,
        district,
        party,
        electionDate: new Date(electionDate),
        // Set later from the dashboard; 0 means no goal yet.
        voteGoal: 0,
        fundraisingGoalCents: 0,
      },
    });
    await tx.campaignMembership.create({
      data: { userId: user.id, campaignId: campaign.id, role: "owner" },
    });
    // The owner is on their own volunteer roster from the start, so they can
    // canvass right away without adding themselves first.
    await linkOwnVolunteer(campaign.id, user.id, tx);
  });

  return NextResponse.json({ ok: true });
}
