import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireCampaignAccess } from "@/lib/api-auth";
import { parseBody } from "@/lib/api-validate";
import { donorCreateSchema } from "@/lib/validation/donor";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const capacity = sp.get("capacity");
  const type = sp.get("type");
  const q = sp.get("q") ?? "";
  const campaignId = sp.get("campaignId");
  const access = await requireCampaignAccess(campaignId, { role: "owner" });
  if ("error" in access) return access.error;

  const where: Prisma.DonorWhereInput = { campaignId: access.campaignId };
  if (capacity) where.capacity = capacity;
  if (type) where.type = type;
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { employer: { contains: q, mode: "insensitive" } },
    ];
  }

  const donors = await db.donor.findMany({
    where,
    orderBy: [{ capacity: "asc" }, { lastName: "asc" }],
    include: {
      donations: {
        select: { amountCents: true, donationDate: true },
        orderBy: { donationDate: "desc" },
      },
    },
  });

  const items = donors.map((d) => {
    const total = d.donations.reduce((s, x) => s + x.amountCents, 0);
    const last = d.donations[0]?.donationDate.toISOString() ?? null;
    return {
      id: d.id,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      address: d.address,
      city: d.city,
      state: d.state,
      zip: d.zip,
      employer: d.employer,
      occupation: d.occupation,
      type: d.type,
      capacity: d.capacity,
      isRecurring: d.isRecurring,
      notes: d.notes,
      voterId: d.voterId,
      campaignId: d.campaignId,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      totalDonatedCents: total,
      donationCount: d.donations.length,
      lastDonationDate: last,
    };
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, donorCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { campaignId, ...f } = parsed.data;
  const access = await requireCampaignAccess(campaignId, { role: "owner" });
  if ("error" in access) return access.error;

  const donor = await db.donor.create({
    data: {
      firstName: f.firstName,
      lastName: f.lastName,
      email: f.email || null,
      phone: f.phone || null,
      address: f.address || null,
      city: f.city || null,
      state: f.state || null,
      zip: f.zip || null,
      employer: f.employer || null,
      occupation: f.occupation || null,
      type: f.type ?? "individual",
      capacity: f.capacity ?? "unknown",
      isRecurring: f.isRecurring ?? false,
      notes: f.notes || null,
      campaignId: access.campaignId,
    },
  });
  return NextResponse.json(donor);
}
