import { describe, expect, test } from "bun:test";
import { autoMapColumns, birthYearOf, buildImportRows, parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  test("splits simple rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  test("handles quoted fields with commas, newlines, and escaped quotes", () => {
    const text = 'name,note\n"Doe, Jane","said ""hi""\nthen left"\n';
    expect(parseCsv(text)).toEqual([
      ["name", "note"],
      ["Doe, Jane", 'said "hi"\nthen left'],
    ]);
  });

  test("handles CRLF, a BOM, and a missing trailing newline", () => {
    expect(parseCsv("\uFEFFa,b\r\n1,2\r\n3,4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  test("keeps empty cells and drops blank lines", () => {
    expect(parseCsv("a,,c\n\n,,\n")).toEqual([["a", "", "c"], ["", "", ""]]);
  });

  test("empty input yields no rows", () => {
    expect(parseCsv("")).toEqual([]);
  });

  test("detects tab-separated files", () => {
    expect(parseCsv("Voter ID\tLast Name\tNotes\r\n123\tDoe, Jr\t\"a\tb\"\n")).toEqual([
      ["Voter ID", "Last Name", "Notes"],
      ["123", "Doe, Jr", "a\tb"],
    ]);
  });

  test("stays comma-separated when tabs only appear in data", () => {
    expect(parseCsv("a,b\n1\t2,3")).toEqual([["a", "b"], ["1\t2", "3"]]);
  });
});

describe("autoMapColumns", () => {
  test("matches aliases regardless of case, spaces, and punctuation", () => {
    expect(
      autoMapColumns(["FNAME", "Last_Name", "Street Address", "Zip Code", "Precinct Name", "Party Affiliation", "Phone Number", "SUPPORT"])
    ).toEqual({
      firstName: 0,
      lastName: 1,
      address: 2,
      zip: 3,
      precinct: 4,
      partyAffiliation: 5,
      phone: 6,
      supportLevel: 7,
    });
  });

  test("ignores unknown headers and keeps the first matching column", () => {
    expect(autoMapColumns(["Mailing Address", "First", "first name", "Email"])).toEqual({ firstName: 1, email: 3 });
  });

  test("maps a county voter file's headers", () => {
    expect(
      autoMapColumns([
        "VOTER_ID", "LAST_NAME", "FIRST_NAME", "MIDDLE_NAME", "DATE_OF_BIRTH",
        "RESIDENCE_ADDRESS", "RESIDENCE_CITY", "RESIDENCE_ZIP", "PRECINCT", "PARTY",
      ])
    ).toEqual({
      countyVoterId: 0,
      lastName: 1,
      firstName: 2,
      birthYear: 4,
      address: 5,
      city: 6,
      zip: 7,
      precinct: 8,
      partyAffiliation: 9,
    });
  });

  test("maps split house number and street columns", () => {
    expect(autoMapColumns(["First Name", "Last Name", "House Number", "Street Name", "Zip"])).toEqual({
      firstName: 0,
      lastName: 1,
      houseNumber: 2,
      street: 3,
      zip: 4,
    });
  });
});

describe("buildImportRows", () => {
  test("maps cells by column, trims, and omits empty values", () => {
    expect(buildImportRows([[" Ana ", "", "x"], ["Bo"]], { firstName: 0, lastName: 1, email: 2 })).toEqual([
      { firstName: "Ana", email: "x" },
      { firstName: "Bo" },
    ]);
  });

  test("joins house number and street into the address", () => {
    const mapping = { firstName: 0, houseNumber: 1, street: 2 };
    expect(buildImportRows([["Ana", "12", " Main St "], ["Bo", "", "Elm St"], ["Cy", "", ""]], mapping)).toEqual([
      { firstName: "Ana", address: "12 Main St" },
      { firstName: "Bo", address: "Elm St" },
      { firstName: "Cy" },
    ]);
  });

  test("a mapped address column wins over house number and street", () => {
    expect(buildImportRows([["12 Main St", "99", "Oak Ave"]], { address: 0, houseNumber: 1, street: 2 })).toEqual([
      { address: "12 Main St" },
    ]);
  });
});

describe("birthYearOf", () => {
  test("reads the year from common date-of-birth formats", () => {
    expect(["03/15/1980", "1980-03-15", "1980-03-15T00:00:00", "15-MAR-1980", "1980", "19800315", "03151980"].map(birthYearOf)).toEqual(
      Array(7).fill(1980)
    );
  });

  test("returns null when there is no plausible year", () => {
    expect(["", "unknown", "03/15/80", "2999-01-01", "1850"].map(birthYearOf)).toEqual(Array(5).fill(null));
  });
});
