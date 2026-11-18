import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const TOO_MANY_REQUESTS = () =>
  NextResponse.json({ error: "Too many requests" }, { status: 429 });

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

type UserResult = { error: NextResponse } | { userId: string };

export async function requireUser(): Promise<UserResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    // Pre-auth requests are rate-limited by IP, since there's no user identity yet.
    const ip = getClientIp(await headers());
    if (!checkRateLimit(`ip:${ip}`, { max: 60, windowMs: 60_000 })) {
      return { error: TOO_MANY_REQUESTS() };
    }
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!checkRateLimit(`user:${session.user.id}`, { max: 240, windowMs: 60_000 })) {
    return { error: TOO_MANY_REQUESTS() };
  }

  return { userId: session.user.id };
}

type CampaignAccessResult =
  | { error: NextResponse }
  | { userId: string; campaignId: string; role: "owner" | "member" };

export async function requireCampaignAccess(
  campaignId: string | null | undefined,
  opts?: { role: "owner" }
): Promise<CampaignAccessResult> {
  const u = await requireUser();
  if ("error" in u) return u;

  if (!campaignId) {
    return { error: NextResponse.json({ error: "campaignId required" }, { status: 400 }) };
  }

  const membership = await db.campaignMembership.findUnique({
    where: { userId_campaignId: { userId: u.userId, campaignId } },
  });
  if (!membership) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (opts?.role === "owner" && membership.role !== "owner") {
    return { error: NextResponse.json({ error: "Owner role required" }, { status: 403 }) };
  }

  return {
    userId: u.userId,
    campaignId,
    role: membership.role as "owner" | "member",
  };
}

type PlatformOwnerResult = { error: NextResponse } | { userId: string };

// Deployment-wide access, separate from any CampaignMembership — gates the
// read-only cross-campaign admin view. Granted to whoever created the first
// account in the deployment (see src/app/api/seed/route.ts and
// src/app/api/signup/route.ts), transferable via POST /api/platform/transfer.
export async function requirePlatformOwner(): Promise<PlatformOwnerResult> {
  const u = await requireUser();
  if ("error" in u) return u;

  const user = await db.user.findUnique({
    where: { id: u.userId },
    select: { isPlatformOwner: true },
  });
  if (!user?.isPlatformOwner) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: u.userId };
}

type FindFirstIdDelegate = {
  findFirst(args: {
    where: { id: string; campaignId: string };
    select: { id: true };
  }): Promise<{ id: string } | null>;
};

// Verifies a secondary foreign-key id (donorId, voterId, volunteerId, ...)
// actually belongs to the caller's authorized campaign, not just that the
// top-level campaignId does. Returns null when valid (or when id is absent),
// otherwise a ready-to-return 400 response.
export async function assertBelongsToCampaign(
  delegate: FindFirstIdDelegate,
  id: string | null | undefined,
  campaignId: string,
  label: string
): Promise<NextResponse | null> {
  if (!id) return null;
  const row = await delegate.findFirst({ where: { id, campaignId }, select: { id: true } });
  return row ? null : NextResponse.json({ error: `Invalid ${label}` }, { status: 400 });
}

// Who a request may log contacts or hold claims as. Owners may act as any
// volunteer in the campaign (they run walk lists for the whole team); members
// may only act as the roster entry linked to their own login.
export async function assertCanActAsVolunteer(
  access: { userId: string; campaignId: string; role: "owner" | "member" },
  volunteerId: string
): Promise<NextResponse | null> {
  const volunteer = await db.volunteer.findFirst({
    where: { id: volunteerId, campaignId: access.campaignId },
    select: { userId: true },
  });
  if (!volunteer) return NextResponse.json({ error: "Invalid volunteer" }, { status: 400 });
  if (access.role !== "owner" && volunteer.userId !== access.userId) {
    return NextResponse.json({ error: "You can only canvass or call as yourself" }, { status: 403 });
  }
  return null;
}
