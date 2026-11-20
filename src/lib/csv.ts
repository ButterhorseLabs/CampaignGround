// Minimal RFC 4180 CSV parsing and voter-import column mapping. Runs in the
// browser (import dialog), so it stays dependency-free.

/**
 * Parses CSV or tab-separated text into rows of cells. Tab-separated is chosen
 * when the header line has more tabs than commas. Handles quoted fields,
 * escaped quotes, CRLF/LF/CR, and a leading BOM. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const header = text.slice(i).split(/[\r\n]/, 1)[0];
  const delimiter = header.split("\t").length > header.split(",").length ? "\t" : ",";

  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
    field = "";
  };

  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

export const IMPORT_FIELDS = [
  { key: "firstName", label: "First name", aliases: ["first name", "first", "fname", "given name"] },
  { key: "lastName", label: "Last name", aliases: ["last name", "last", "lname", "surname"] },
  {
    key: "countyVoterId",
    label: "County voter ID",
    aliases: ["voter id", "county voter id", "voter id number", "voter number", "voter registration number", "registration number"],
  },
  { key: "email", label: "Email", aliases: ["email", "email address", "e-mail"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone number", "telephone"] },
  { key: "partyAffiliation", label: "Party", aliases: ["party", "party affiliation"] },
  {
    key: "address",
    label: "Address",
    aliases: [
      "address", "street address", "residential address", "residence address", "res address",
      "residence street address", "res street address", "residential address 1", "residence address line 1", "address line 1",
    ],
  },
  {
    key: "houseNumber",
    label: "House number",
    aliases: ["house number", "house no", "house num", "street number", "residence house number", "res house number"],
  },
  { key: "street", label: "Street", aliases: ["street", "street name", "residence street name", "res street name"] },
  { key: "city", label: "City", aliases: ["city", "residence city", "residential city", "res city"] },
  { key: "state", label: "State", aliases: ["state", "residence state", "residential state", "res state"] },
  {
    key: "zip",
    label: "ZIP",
    aliases: ["zip", "zip code", "postal code", "zipcode", "zip5", "residence zip", "residence zip code", "residential zip", "res zip"],
  },
  { key: "precinct", label: "Precinct", aliases: ["precinct", "precinct name", "precinct code", "precinct number"] },
  { key: "birthYear", label: "Birth year", aliases: ["birth year", "year of birth", "date of birth", "dob", "birth date"] },
  { key: "supportLevel", label: "Support level", aliases: ["support", "support level"] },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
/** Field → zero-based CSV column index. Absent means "don't import". */
export type ColumnMapping = Partial<Record<ImportField, number>>;
/** What the import API receives: house number and street are folded into `address`. */
export type ImportRow = Partial<Record<Exclude<ImportField, "houseNumber" | "street">, string>>;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Matches header cells to import fields, ignoring case, spaces, and punctuation. First matching column wins. */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map(normalize);
  for (const field of IMPORT_FIELDS) {
    const aliases = field.aliases.map(normalize);
    const index = normalized.findIndex((h) => aliases.includes(h));
    if (index !== -1) mapping[field.key] = index;
  }
  return mapping;
}

/**
 * Turns data rows (header excluded) into import objects using the mapping.
 * Empty cells are omitted. Without a mapped address column, house number and
 * street are joined into the address.
 */
export function buildImportRows(rows: string[][], mapping: ColumnMapping): ImportRow[] {
  const { houseNumber, street, ...direct } = mapping;
  return rows.map((cells) => {
    const out: ImportRow = {};
    for (const [key, index] of Object.entries(direct) as [keyof ImportRow, number][]) {
      const value = cells[index]?.trim();
      if (value) out[key] = value;
    }
    if (direct.address === undefined) {
      const joined = [houseNumber, street].map((i) => (i === undefined ? "" : cells[i]?.trim() ?? "")).filter(Boolean).join(" ");
      if (joined) out.address = joined;
    }
    return out;
  });
}

/** The year from a date-of-birth (or birth-year) cell, or null when no plausible year is present. */
export function birthYearOf(value: string): number | null {
  const v = value.trim();
  // Undelimited dates: YYYYMMDD or MMDDYYYY.
  const candidates = /^\d{8}$/.test(v) ? [v.slice(0, 4), v.slice(4)] : v.match(/\b\d{4}\b/g) ?? [];
  const thisYear = new Date().getFullYear();
  for (const c of candidates) {
    const year = Number(c);
    if (year >= 1900 && year <= thisYear) return year;
  }
  return null;
}
