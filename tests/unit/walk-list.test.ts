import { describe, expect, test } from "bun:test";
import { buildDoors, parseAddress } from "@/lib/walk-list";

describe("parseAddress", () => {
  test("splits the house number from the street name", () => {
    expect(parseAddress("123 Main St")).toEqual({ number: 123, street: "main st" });
  });

  test("ignores case, extra spaces and a letter suffix on the number", () => {
    expect(parseAddress("  12B   ELM  St ")).toEqual({ number: 12, street: "elm st" });
  });

  test("drops the apartment part so units stay on their street", () => {
    expect(parseAddress("40 Oak Ave Apt 3")).toEqual({ number: 40, street: "oak ave" });
    expect(parseAddress("40 Oak Ave #3")).toEqual({ number: 40, street: "oak ave" });
    expect(parseAddress("40 Oak Ave, Unit 3")).toEqual({ number: 40, street: "oak ave" });
  });

  test("returns null when there is no house number", () => {
    expect(parseAddress("PO Box 55")).toBeNull();
    expect(parseAddress("Main St")).toBeNull();
    expect(parseAddress("")).toBeNull();
    expect(parseAddress(null)).toBeNull();
  });
});

const voter = (id: string, address: string | null, householdId: string | null = null) => ({
  id,
  householdId,
  household: householdId && address ? { address } : null,
  registeredAddress: householdId ? null : address,
});

const order = (doors: { address: string | null }[]) => doors.map((d) => d.address);

describe("buildDoors", () => {
  test("orders by street name, then house number as a number", () => {
    const doors = buildDoors([
      voter("a", "10 Elm St"),
      voter("b", "2 Oak Ave"),
      voter("c", "2 Elm St"),
      voter("d", "100 Elm St"),
      voter("e", "9 Elm St"),
    ]);
    expect(order(doors)).toEqual(["2 Elm St", "9 Elm St", "10 Elm St", "100 Elm St", "2 Oak Ave"]);
  });

  test("keeps odd and even sides of a street together", () => {
    const doors = buildDoors([voter("a", "4 Elm St"), voter("b", "3 Elm St"), voter("c", "1 Elm St"), voter("d", "2 Elm St")]);
    expect(order(doors)).toEqual(["1 Elm St", "2 Elm St", "3 Elm St", "4 Elm St"]);
  });

  test("puts unparseable and missing addresses last", () => {
    const doors = buildDoors([
      voter("a", "PO Box 9"),
      voter("b", null),
      voter("c", "5 Zinnia Ln"),
      voter("d", "Rural Route 2"),
    ]);
    expect(order(doors)).toEqual(["5 Zinnia Ln", "PO Box 9", "Rural Route 2", null]);
  });

  test("groups housemates under one door and keeps voters without a household as their own door", () => {
    const doors = buildDoors([
      voter("b", "12 Elm St", "h1"),
      voter("solo", "12 Elm St"),
      voter("a", "12 Elm St", "h1"),
    ]);
    expect(doors).toHaveLength(2);
    expect(doors.map((d) => d.voters.map((v) => v.id).sort())).toEqual([["a", "b"], ["solo"]]);
  });

  test("orders units at one building by unit number", () => {
    const doors = buildDoors([
      voter("a", "40 Oak Ave Apt 10", "h10"),
      voter("b", "40 Oak Ave Apt 2", "h2"),
      voter("c", "40 Oak Ave", "h0"),
    ]);
    expect(order(doors)).toEqual(["40 Oak Ave", "40 Oak Ave Apt 2", "40 Oak Ave Apt 10"]);
  });
});
