// Minimal RFC 4180 CSV parsing and voter-import column mapping. Runs in the
// browser (import dialog), so it stays dependency-free.

/** Parses CSV text into rows of cells. Handles quoted fields, escaped quotes, CRLF/LF/CR, and a leading BOM. Blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

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
    } else if (c === ",") {
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
  { key: "email", label: "Email", aliases: ["email", "email address", "e-mail"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone number", "telephone"] },
  { key: "partyAffiliation", label: "Party", aliases: ["party", "party affiliation"] },
  { key: "address", label: "Address", aliases: ["address", "street", "street address", "residential address"] },
  { key: "city", label: "City", aliases: ["city"] },
  { key: "state", label: "State", aliases: ["state"] },
  { key: "zip", label: "ZIP", aliases: ["zip", "zip code", "postal code", "zipcode"] },
  { key: "precinct", label: "Precinct", aliases: ["precinct", "precinct name"] },
  { key: "supportLevel", label: "Support level", aliases: ["support", "support level"] },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
/** Field → zero-based CSV column index. Absent means "don't import". */
export type ColumnMapping = Partial<Record<ImportField, number>>;

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

/** Turns data rows (header excluded) into import objects using the mapping. Empty cells are omitted. */
export function buildImportRows(rows: string[][], mapping: ColumnMapping): Partial<Record<ImportField, string>>[] {
  return rows.map((cells) => {
    const out: Partial<Record<ImportField, string>> = {};
    for (const [key, index] of Object.entries(mapping) as [ImportField, number][]) {
      const value = cells[index]?.trim();
      if (value) out[key] = value;
    }
    return out;
  });
}
