import { z } from "zod";
import { PARTIES } from "@/lib/types";

/** Shown under every new-password field; must describe passwordSchema exactly. */
export const PASSWORD_RULE = "At least 12 characters";

export const passwordSchema = z.string().min(12, `Use ${PASSWORD_RULE.toLowerCase()}.`);

const DAY_MS = 86_400_000;
/** How far ahead a campaign's election date may be set. */
export const MAX_ELECTION_YEARS = 4;

/**
 * Earliest and latest election dates (YYYY-MM-DD) for a new campaign. The
 * lower bound is yesterday in UTC so a signup late in the evening anywhere in
 * the world can still pick "today".
 */
export function electionDateBounds(now = Date.now()) {
  const max = new Date(now);
  max.setUTCFullYear(max.getUTCFullYear() + MAX_ELECTION_YEARS);
  return {
    min: new Date(now - DAY_MS).toISOString().slice(0, 10),
    max: max.toISOString().slice(0, 10),
  };
}

const required = (message: string) => z.string().trim().min(1, message).max(200);

export const signupSchema = z.object({
  name: required("Enter your name."),
  email: z.email("Enter an email like name@example.com."),
  password: passwordSchema,
  candidateName: required("Enter the candidate's name."),
  officeSought: required("Enter the office, like City Council."),
  district: required("Enter the district, like Ward 3."),
  // Omitted for nonpartisan races.
  party: z.enum(PARTIES.map((p) => p.value) as [string, ...string[]]).optional(),
  electionDate: z.iso.date("Enter the election date.").refine((d) => {
    const { min, max } = electionDateBounds();
    return d >= min && d <= max;
  }, `Pick an election date between today and ${MAX_ELECTION_YEARS} years from now.`),
});
