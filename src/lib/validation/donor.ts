import { z } from "zod";

export const donorTypeEnum = z.enum(["individual", "pac", "small-business", "family"]);
export const donorCapacityEnum = z.enum(["major", "mid", "small", "unknown"]);

const optionalText = z.string().trim().max(500).nullable().optional();

export const donorCreateSchema = z.object({
  campaignId: z.string().min(1),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: optionalText,
  phone: optionalText,
  address: optionalText,
  city: optionalText,
  state: optionalText,
  zip: optionalText,
  employer: optionalText,
  occupation: optionalText,
  type: donorTypeEnum.optional(),
  capacity: donorCapacityEnum.optional(),
  isRecurring: z.boolean().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
