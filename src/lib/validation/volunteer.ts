import { z } from "zod";

export const volunteerRoleEnum = z.enum([
  "coordinator",
  "canvasser",
  "phone-banker",
  "designer",
  "data",
  "general",
]);

export const volunteerStatusEnum = z.enum(["active", "inactive", "lead"]);

export const volunteerPatchSchema = z.object({
  id: z.string().min(1),
  status: volunteerStatusEnum.optional(),
  role: volunteerRoleEnum.optional(),
  hoursLogged: z.number().min(0).optional(),
  notes: z.string().nullable().optional(),
});

const optionalText = z.string().trim().max(500).nullable().optional();

// Either link the caller's own login to a roster entry (`self: true`), or add
// an unlinked roster entry for someone else.
export const volunteerCreateSchema = z.union([
  z.object({
    campaignId: z.string().min(1),
    self: z.literal(true),
  }),
  z.object({
    campaignId: z.string().min(1),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: optionalText,
    phone: optionalText,
    role: volunteerRoleEnum.optional(),
    status: volunteerStatusEnum.optional(),
    zip: optionalText,
    notes: z.string().max(5000).nullable().optional(),
  }),
]);
