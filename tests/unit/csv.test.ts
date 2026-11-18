import { describe, expect, test } from "bun:test";
import { autoMapColumns, buildImportRows, parseCsv } from "@/lib/csv";

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
    expect(autoMapColumns(["Voter ID", "First", "first name", "Email"])).toEqual({ firstName: 1, email: 3 });
  });
});

describe("buildImportRows", () => {
  test("maps cells by column, trims, and omits empty values", () => {
    expect(buildImportRows([[" Ana ", "", "x"], ["Bo"]], { firstName: 0, lastName: 1, email: 2 })).toEqual([
      { firstName: "Ana", email: "x" },
      { firstName: "Bo" },
    ]);
  });
});
