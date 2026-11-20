import { describe, expect, test } from "bun:test";
import { summarizeFunnel, type FunnelRow } from "@/lib/activation-funnel";

const HOUR = 60 * 60 * 1000;
const signup = "2026-09-01T00:00:00.000Z";

function row(activatedAfterHours: number | null, overrides: Partial<FunnelRow> = {}): FunnelRow {
  return {
    campaignId: Math.random().toString(36),
    campaignName: "Campaign",
    officeSought: "City Council",
    ownerName: "Owner",
    teamSize: 1,
    signedUpAt: signup,
    firstVoterAt: null,
    firstVolunteerAt: null,
    firstInviteAt: null,
    activatedAt:
      activatedAfterHours === null
        ? null
        : new Date(Date.parse(signup) + activatedAfterHours * HOUR).toISOString(),
    ...overrides,
  };
}

describe("summarizeFunnel", () => {
  test("no activated campaigns has no median", () => {
    const summary = summarizeFunnel([row(null), row(null)]);
    expect(summary.medianSignupToActivationMs).toBeNull();
    expect(summary.reached).toEqual({
      signedUpAt: 2,
      firstVoterAt: 0,
      firstVolunteerAt: 0,
      firstInviteAt: 0,
      activatedAt: 0,
    });
  });

  test("median of an odd count is the middle activation time, ignoring unactivated campaigns", () => {
    const summary = summarizeFunnel([row(48), row(null), row(2), row(5)]);
    expect(summary.medianSignupToActivationMs).toBe(5 * HOUR);
    expect(summary.reached.activatedAt).toBe(3);
  });

  test("median of an even count averages the two middle activation times", () => {
    expect(summarizeFunnel([row(10), row(2), row(4), row(100)]).medianSignupToActivationMs).toBe(7 * HOUR);
  });
});
