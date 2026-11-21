import { describe, expect, test } from "bun:test";
import { buildCallScript } from "../../src/lib/call-script";

const base = {
  voterFirstName: "Lucas",
  callerFirstName: "Tom",
  candidateName: "Dana Reyes",
  officeSought: "School Board",
  district: "Zone 2",
  electionDate: "2026-12-08T00:00:00.000Z",
  now: new Date(2026, 10, 21),
};

describe("buildCallScript", () => {
  test("uses the caller, the campaign and the election date", () => {
    const script = buildCallScript(base).join("\n");
    expect(script).toContain("Hi, is this Lucas?");
    expect(script).toContain("My name is Tom. I'm a volunteer with Dana Reyes's campaign for School Board, Zone 2.");
    expect(script).toContain("Election Day is Tuesday, December 8.");
    expect(script).not.toMatch(/Jordan|Maya|November 4/);
  });

  test("does not repeat a district the office already names", () => {
    const script = buildCallScript({ ...base, officeSought: "City Council, District 4", district: "District 4" });
    expect(script[1]).toContain("campaign for City Council, District 4.");
  });

  test("drops the election line once the date has passed", () => {
    const script = buildCallScript({ ...base, electionDate: "2026-11-03T00:00:00.000Z" });
    expect(script.some((l) => l.startsWith("Election Day"))).toBe(false);
  });
});
