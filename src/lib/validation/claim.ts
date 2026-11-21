import { z } from "zod";

export const claimChannelEnum = z.enum(["call", "canvass"]);

export const claimBodySchema = z.object({
  voterId: z.string().min(1),
  channel: claimChannelEnum,
  volunteerId: z.string().min(1),
});

// The holder's client renews its claim every minute while the door/call is
// open (see src/lib/claims.ts), so this TTL only reaps abandoned claims.
export const CLAIM_TTL_MS = 5 * 60 * 1000;
