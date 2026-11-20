import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Returns the user's own volunteer entry in a campaign, linking it first if
// needed: an existing linked entry wins, then an unlinked entry with the
// user's email, otherwise a new entry from the account name. Used by signup,
// invite acceptance and "Add yourself", so each login has one entry.
export async function linkOwnVolunteer(campaignId: string, userId: string, client: Prisma.TransactionClient = db) {
  const existing = await client.volunteer.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
  });
  if (existing) return existing;

  const user = await client.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true },
  });

  try {
    const unlinked = await client.volunteer.findFirst({
      where: { campaignId, userId: null, email: { equals: user.email, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
    });
    if (unlinked) {
      return await client.volunteer.update({ where: { id: unlinked.id }, data: { userId } });
    }

    const [firstName, ...rest] = user.name.trim().split(/\s+/).filter(Boolean);
    return await client.volunteer.create({
      data: {
        firstName: firstName ?? user.email.split("@")[0],
        lastName: rest.join(" "),
        email: user.email,
        role: "general",
        status: "active",
        userId,
        campaignId,
      },
    });
  } catch (e) {
    // A concurrent request linked this user first: return that entry.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return client.volunteer.findUniqueOrThrow({
        where: { campaignId_userId: { campaignId, userId } },
      });
    }
    throw e;
  }
}
