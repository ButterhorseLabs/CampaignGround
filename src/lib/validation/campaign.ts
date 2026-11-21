import { z } from "zod";

// 0 means "no goal set", the same as leaving it blank at signup.
export const campaignGoalsSchema = z.object({
  campaignId: z.string().min(1),
  voteGoal: z.number().int().min(0).max(100_000_000),
  fundraisingGoalCents: z.number().int().min(0).max(100_000_000_000),
});
