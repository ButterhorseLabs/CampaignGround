import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireCampaignAccess, assertBelongsToCampaign } from "@/lib/api-auth";
import { parseBody } from "@/lib/api-validate";
import { taskCreateSchema, taskIdSchema, taskPatchSchema } from "@/lib/validation/task";

const TASK_LIMIT = 200;
// Priority is stored as a word, so the database would sort it alphabetically.
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const priority = sp.get("priority");
  const assignedTo = sp.get("assignedTo");
  const campaignId = sp.get("campaignId");
  const access = await requireCampaignAccess(campaignId);
  if ("error" in access) return access.error;

  const where: Prisma.TaskWhereInput = { campaignId: access.campaignId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignedTo) where.assignedVolunteerId = assignedTo;

  // Earliest due first, so if the cap bites it drops the work furthest out.
  const tasks = await db.task.findMany({
    where,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    include: {
      volunteer: { select: { firstName: true, lastName: true } },
      voter: { select: { firstName: true, lastName: true } },
    },
    take: TASK_LIMIT + 1,
  });
  const truncated = tasks.length > TASK_LIMIT;
  const items = tasks
    .slice(0, TASK_LIMIT)
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));

  return NextResponse.json({
    truncated,
    items: items.map((t) => ({
      ...t,
      dueDate: t.dueDate?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const parsed = await parseBody(req, taskPatchSchema);
  if ("error" in parsed) return parsed.error;
  const { id, status, priority, dueDate, title, description, assignedVolunteerId } = parsed.data;

  const task = await db.task.findUnique({ where: { id }, select: { campaignId: true } });
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  const access = await requireCampaignAccess(task.campaignId);
  if ("error" in access) return access.error;

  const volunteerErr = await assertBelongsToCampaign(db.volunteer, assignedVolunteerId, access.campaignId, "volunteer");
  if (volunteerErr) return volunteerErr;

  const data: Prisma.TaskUpdateInput = {};
  if (status) data.status = status;
  if (priority) data.priority = priority;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description || null;
  if (assignedVolunteerId !== undefined) {
    data.volunteer = assignedVolunteerId ? { connect: { id: assignedVolunteerId } } : { disconnect: true };
  }
  const updated = await db.task.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, taskCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { title, description, priority, dueDate, campaignId, assignedVolunteerId } = parsed.data;
  const access = await requireCampaignAccess(campaignId);
  if ("error" in access) return access.error;

  const volunteerErr = await assertBelongsToCampaign(db.volunteer, assignedVolunteerId, access.campaignId, "volunteer");
  if (volunteerErr) return volunteerErr;

  const task = await db.task.create({
    data: {
      title,
      description: description || null,
      priority: priority ?? "medium",
      dueDate: dueDate ? new Date(dueDate) : null,
      campaignId: access.campaignId,
      assignedVolunteerId: assignedVolunteerId || null,
      status: "todo",
    },
  });
  return NextResponse.json(task);
}

// Owners only, like deleting voters: a task is shared campaign record.
export async function DELETE(req: NextRequest) {
  const parsed = await parseBody(req, taskIdSchema);
  if ("error" in parsed) return parsed.error;
  const task = await db.task.findUnique({ where: { id: parsed.data.id }, select: { campaignId: true } });
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  const access = await requireCampaignAccess(task.campaignId, { role: "owner" });
  if ("error" in access) return access.error;

  await db.task.delete({ where: { id: parsed.data.id } });
  return NextResponse.json({ ok: true });
}
