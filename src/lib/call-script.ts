// The phone bank script, built from the campaign's own record so every caller
// reads true facts: the right candidate, office and election date, and their
// own name. Nonpartisan by construction: no party, no issue positions.

export interface CallScriptInput {
  voterFirstName: string;
  callerFirstName: string;
  candidateName: string;
  officeSought: string;
  district: string;
  /** ISO date of the election. */
  electionDate: string;
  /** For tests; defaults to now. */
  now?: Date;
}

/** Election dates are calendar days stored at midnight UTC; read them in UTC so no timezone shifts the day. */
function electionDay(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Script paragraphs, in reading order. Lines whose facts are missing or past are left out. */
export function buildCallScript(s: CallScriptInput): string[] {
  const office = s.officeSought.trim();
  const district = s.district.trim();
  // "City Council, District 4" already names its district.
  const where = district && !office.toLowerCase().includes(district.toLowerCase()) ? `, ${district}` : "";
  const race = office ? `${s.candidateName}'s campaign for ${office}${where}` : `${s.candidateName}'s campaign`;

  const day = electionDay(s.electionDate);
  const now = s.now ?? new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const electionLine =
    day.getTime() >= today
      ? `Election Day is ${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}.`
      : null;

  return [
    `Hi, is this ${s.voterFirstName}?`,
    `My name is ${s.callerFirstName}. I'm a volunteer with ${race}. Do you have a minute?`,
    electionLine,
    `Can we count on your support?`,
    `(If yes) Thank you! Would you like a yard sign, or to volunteer?`,
    `(If undecided) What issues matter most to you this year?`,
  ].filter((line): line is string => line !== null);
}
