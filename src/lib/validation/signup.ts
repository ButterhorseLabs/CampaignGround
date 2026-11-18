import { z } from "zod";

/** Shown under every new-password field; must describe passwordSchema exactly. */
export const PASSWORD_RULE = "At least 12 characters";

export const passwordSchema = z.string().min(12, `${PASSWORD_RULE}.`);

export const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema,
  candidateName: z.string().min(1),
  officeSought: z.string().min(1),
  district: z.string().min(1),
  party: z.string().min(1).optional(),
  electionDate: z.string().min(1),
  voteGoal: z.number().int().positive().optional(),
  fundraisingGoalCents: z.number().int().positive().optional(),
});
