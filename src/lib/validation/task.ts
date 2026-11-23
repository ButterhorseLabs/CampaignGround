import { z } from "zod";

export const taskPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);
export const taskStatusEnum = z.enum(["todo", "in-progress", "done", "blocked"]);

const title = z.string().trim().min(1).max(200);
const description = z.string().trim().max(2000).nullable().optional();

export const taskCreateSchema = z.object({
  title,
  description,
  priority: taskPriorityEnum.optional(),
  dueDate: z.string().nullable().optional(),
  campaignId: z.string().min(1),
  assignedVolunteerId: z.string().nullable().optional(),
});

export const taskIdSchema = z.object({ id: z.string().min(1) });

export const taskPatchSchema = taskIdSchema.extend({
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.string().nullable().optional(),
  title: title.optional(),
  description,
  assignedVolunteerId: z.string().nullable().optional(),
});
