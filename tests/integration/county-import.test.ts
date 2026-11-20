// Importing the voter file a county election office hands out, through the
// same parse → auto-map → build path the import dialog uses, with no manual
// column remapping.
import { beforeAll, describe, expect, test } from "bun:test";
import { fetchAs, signupAndLogin, type TestAccount } from "../helpers/client";
import { testDb } from "../helpers/testDb";
import { autoMapColumns, buildImportRows, parseCsv } from "@/lib/csv";

let owner: TestAccount;
let campaignId: string;

// The dialog sends at most this many rows per request.
const CHUNK_SIZE = 1000;

async function importFile(text: string) {
  const [headers, ...data] = parseCsv(text);
  const rows = buildImportRows(data, autoMapColumns(headers));
  let created = 0;
  const skipped: { row: number; reason: string }[] = [];
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const res = await fetchAs(owner.cookie, "/api/voters/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, rows: rows.slice(start, start + CHUNK_SIZE) }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    created += body.created;
    skipped.push(...body.skipped);
  }
  return { created, skipped };
}

const tsv = (lines: string[][]) => lines.map((l) => l.join("\t")).join("\r\n") + "\r\n";

const COUNTY_FILE = tsv([
  ["VOTER_ID", "LAST_NAME", "FIRST_NAME", "MIDDLE_NAME", "DATE_OF_BIRTH", "HOUSE_NUMBER", "STREET_NAME", "RESIDENCE_CITY", "RESIDENCE_ZIP", "PRECINCT"],
  ["100201", "Okafor", "Grace", "A", "04/12/1961", "418", "Birch Ln", "Rivermont", "97001", "North 3"],
  ["100202", "Okafor", "James", "", "1959-09-30", "418", "Birch Ln", "Rivermont", "97001", "North 3"],
  ["100203", "Haugen", "Lars", "P", "11/02/1990", "22", "Cedar Ave", "Rivermont", "97002", "South 1"],
]);

beforeAll(async () => {
  owner = await signupAndLogin();
  campaignId = owner.campaignId;
});

describe("county voter file import", () => {
  test("imports a county file with no manual remapping", async () => {
    expect(await importFile(COUNTY_FILE)).toEqual({ created: 3, skipped: [] });

    const grace = await testDb.voter.findFirstOrThrow({
      where: { campaignId, countyVoterId: "100201" },
      include: { precinct: true, household: true },
    });
    expect(grace.firstName).toBe("Grace");
    expect(grace.lastName).toBe("Okafor");
    expect(grace.birthYear).toBe(1961);
    expect(grace.registeredAddress).toBe("418 Birch Ln");
    expect(grace.precinct?.name).toBe("North 3");
    expect(grace.household?.zip).toBe("97001");

    const james = await testDb.voter.findFirstOrThrow({ where: { campaignId, countyVoterId: "100202" } });
    expect(james.birthYear).toBe(1959);
    expect(james.householdId).toBe(grace.householdId);
  });

  test("re-importing the same county file creates 0 new voters", async () => {
    const { created, skipped } = await importFile(COUNTY_FILE);
    expect(created).toBe(0);
    expect(skipped).toHaveLength(3);
    expect(await testDb.voter.count({ where: { campaignId } })).toBe(3);
  });

  test("a matching county voter ID is the same voter even after a move", async () => {
    const moved = tsv([
      ["Voter ID", "First Name", "Last Name", "Residence Address"],
      ["100203", "Lars", "Haugen", "9 Spruce Ct"],
    ]);
    expect((await importFile(moved)).created).toBe(0);
  });

  test("same name and address with different county voter IDs import as 2 voters", async () => {
    const family = tsv([
      ["Voter ID", "First Name", "Last Name", "Residence Address"],
      ["200001", "Robert", "Lindqvist", "7 Elm St"],
      ["200002", "Robert", "Lindqvist", "7 Elm St"],
    ]);
    expect((await importFile(family)).created).toBe(2);
    // Same IDs again: still the same two voters.
    expect((await importFile(family)).created).toBe(0);
  });

  test("without a county voter ID on both sides, name and address decide", async () => {
    const added = await fetchAs(owner.cookie, "/api/voters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, firstName: "Mira", lastName: "Sato", registeredAddress: "3 Oak St" }),
    });
    expect(added.status).toBe(200);
    const file = tsv([
      ["Voter ID", "First Name", "Last Name", "Residence Address"],
      // County files are often all caps.
      ["300001", "MIRA", "SATO", "3 OAK ST."],
    ]);
    expect((await importFile(file)).created).toBe(0);
  });

  test("a 5,000-row county file imports without timing out", async () => {
    const header = ["Voter ID", "Last Name", "First Name", "Residence Address", "Residence Zip", "Precinct"];
    const rows = Array.from({ length: 5000 }, (_, i) => [
      `9${String(i).padStart(6, "0")}`,
      `Bulk${i % 700}`,
      `Voter${i}`,
      `${100 + (i % 900)} Main St`,
      "97003",
      `Ward ${i % 12}`,
    ]);
    const started = Date.now();
    const { created } = await importFile(tsv([header, ...rows]));
    expect(created).toBe(5000);
    expect(Date.now() - started).toBeLessThan(60_000);
    expect((await importFile(tsv([header, ...rows]))).created).toBe(0);
  }, 180_000);
});
