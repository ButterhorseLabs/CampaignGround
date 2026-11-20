// Setup steps a new campaign goes through on the way to becoming an
// Activated campaign (GLOSSARY.md). Each is a timestamp, or null if the
// campaign hasn't reached that step yet.
export const FUNNEL_STEPS = [
  "signedUpAt",
  "firstVoterAt",
  "firstVolunteerAt",
  "firstInviteAt",
  "activatedAt",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

// Setup progress only: by design (docs/legal/privacy.md) the platform owner
// never sees the contents of a campaign's voter, donor, or contact records.
export type FunnelRow = {
  campaignId: string;
  campaignName: string;
  teamSize: number;
  signedUpAt: string;
} & Record<Exclude<FunnelStep, "signedUpAt">, string | null>;

export interface FunnelSummary {
  reached: Record<FunnelStep, number>;
  medianSignupToActivationMs: number | null;
}

export function summarizeFunnel(rows: FunnelRow[]): FunnelSummary {
  const reached = Object.fromEntries(
    FUNNEL_STEPS.map((step) => [step, rows.filter((r) => r[step] !== null).length])
  ) as Record<FunnelStep, number>;

  const durations = rows
    .filter((r) => r.activatedAt !== null)
    .map((r) => new Date(r.activatedAt!).getTime() - new Date(r.signedUpAt).getTime())
    .sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  const medianSignupToActivationMs =
    durations.length === 0
      ? null
      : durations.length % 2
        ? durations[mid]
        : (durations[mid - 1] + durations[mid]) / 2;

  return { reached, medianSignupToActivationMs };
}
