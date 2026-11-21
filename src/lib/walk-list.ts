// Walk list ordering: doors (households) in street-name, then numeric
// house-number order. Odd and even sides are not split. Addresses without a
// house number sort after every parsed one.

export interface ParsedAddress {
  number: number;
  street: string;
}

// "40 Oak Ave Apt 3", "40 Oak Ave #3", "40 Oak Ave, Unit 3" all walk as 40 Oak Ave.
const UNIT_PART = /(,|\s)\s*(apt|apartment|unit|ste|suite|#).*$|#.*$/i;

export function parseAddress(address: string | null | undefined): ParsedAddress | null {
  const match = /^\s*(\d+)\S*\s+(.+)$/.exec(address ?? "");
  if (!match) return null;
  const street = match[2].replace(UNIT_PART, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!street) return null;
  return { number: Number(match[1]), street };
}

/** The precinctId of the "No precinct" walk list: voters without a precinct. */
export const NO_PRECINCT = "none";

export interface WalkListVoterInput {
  id: string;
  householdId: string | null;
  household: { address: string } | null;
  registeredAddress: string | null;
}

export interface Door<V> {
  /** The household id, or the voter id for a voter without a household. */
  id: string;
  address: string | null;
  voters: V[];
}

export interface DoorVisit {
  outcome: string;
  contactedAt: string;
}

/** A door is done once someone answered it or it can't be canvassed; "not home" stays on the list to retry. */
export const doorIsDone = (door: { lastVisit: DoorVisit | null }) =>
  door.lastVisit !== null && door.lastVisit.outcome !== "not-home";

const addressCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function compareDoors(a: { address: string | null; parsed: ParsedAddress | null }, b: typeof a) {
  if (a.parsed && b.parsed) {
    return (
      addressCollator.compare(a.parsed.street, b.parsed.street) ||
      a.parsed.number - b.parsed.number ||
      addressCollator.compare(a.address ?? "", b.address ?? "")
    );
  }
  if (a.parsed || b.parsed) return a.parsed ? -1 : 1;
  if (a.address === null) return b.address === null ? 0 : 1;
  if (b.address === null) return -1;
  return addressCollator.compare(a.address, b.address);
}

/** Groups voters into doors and returns them in walking order. */
export function buildDoors<V extends WalkListVoterInput>(voters: V[]): Door<V>[] {
  const doors = new Map<string, Door<V>>();
  for (const v of voters) {
    const id = v.householdId ?? v.id;
    const door = doors.get(id);
    if (door) door.voters.push(v);
    else doors.set(id, { id, address: v.household?.address ?? v.registeredAddress ?? null, voters: [v] });
  }
  return [...doors.values()]
    .map((door) => ({ door, address: door.address, parsed: parseAddress(door.address) }))
    .sort((a, b) => compareDoors(a, b) || a.door.id.localeCompare(b.door.id))
    .map((d) => d.door);
}
