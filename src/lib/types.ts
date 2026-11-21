// Shared TypeScript types that mirror the Prisma models (lightweight,
// for client use without pulling in @prisma/client).

export type SupportLevel =
  | "strong-support"
  | "lean-support"
  | "undecided"
  | "lean-oppose"
  | "strong-oppose"
  | "unknown";

export interface Voter {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  partyAffiliation?: string | null;
  registeredAddress?: string | null;
  birthYear?: number | null;
  voterSince?: number | null;
  votedIn2024?: boolean | null;
  votedIn2022?: boolean | null;
  votedIn2020?: boolean | null;
  supportLevel: SupportLevel;
  supportLevelSource?: string;
  volunteer?: boolean;
  hasYardSign?: boolean;
  hasBumperSticker?: boolean;
  notes?: string | null;
  tags?: string | null;
  householdId?: string | null;
  precinctId?: string | null;
  campaignId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Volunteer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  skills?: string | null;
  hoursPledged?: number | null;
  hoursLogged: number;
  status: string;
  zip?: string | null;
  notes?: string | null;
  campaignId: string;
  /** Login this roster entry belongs to, if any. */
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Donor {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  employer?: string | null;
  occupation?: string | null;
  type: string;
  capacity: string;
  isRecurring?: boolean;
  notes?: string | null;
  voterId?: string | null;
  campaignId: string;
  createdAt: string;
  updatedAt: string;
  totalDonatedCents?: number;
  donationCount?: number;
  lastDonationDate?: string | null;
}

export interface Donation {
  id: string;
  amountCents: number;
  donationDate: string;
  method: string;
  inKindDescription?: string | null;
  earmarkNote?: string | null;
  complianceVerified: boolean;
  notes?: string | null;
  campaignId: string;
  donorId: string;
  donor?: Donor;
  createdAt: string;
}

export interface CampaignEvent {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  address?: string | null;
  capacity?: number | null;
  status: string;
  notes?: string | null;
  campaignId: string;
  attendeeCount?: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  campaignId: string;
  assignedVolunteerId?: string | null;
  volunteer?: { firstName: string; lastName: string } | null;
  assignedVoterId?: string | null;
  voter?: { firstName: string; lastName: string } | null;
  eventId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanvassLog {
  id: string;
  householdId?: string | null;
  voterId?: string | null;
  voter?: { firstName: string; lastName: string } | null;
  volunteerId?: string | null;
  volunteer?: { firstName: string; lastName: string } | null;
  campaignId: string;
  outcome: string;
  supportLevel?: string | null;
  yardSign?: boolean;
  issuePriority?: string | null;
  notes?: string | null;
  contactedAt: string;
  createdAt: string;
}

export interface CallLog {
  id: string;
  voterId?: string | null;
  voter?: { firstName: string; lastName: string } | null;
  volunteerId?: string | null;
  volunteer?: { firstName: string; lastName: string } | null;
  campaignId: string;
  outcome: string;
  supportLevel?: string | null;
  issuePriority?: string | null;
  notes?: string | null;
  callLengthSec: number;
  calledAt: string;
  createdAt: string;
}

export interface Precinct {
  id: string;
  name: string;
  code: string;
  ward?: string | null;
  totalRegisteredVoters?: number | null;
  createdAt: string;
}

export interface DashboardMetrics {
  campaign: {
    candidateName: string;
    officeSought: string;
    district: string;
    party?: string | null;
    electionDate: string;
    fundraisingGoalCents: number;
    voteGoal: number;
  };
  totals: {
    voters: number;
    votersContacted: number;
    supporters: number;
    /** Teammates, including the owner. */
    teammates: number;
    /** Invites ever sent, any status. */
    invitesSent: number;
    volunteers: number;
    events: number;
    tasksOpen: number;
    canvassDoors: number;
    callsMade: number;
  };
  /** Owner-only; null for members (donor data). */
  fundraising: {
    raisedCents: number;
    goalCents: number;
    percent: number;
    donors: number;
    donations: number;
    byMethod: { method: string; totalCents: number }[];
    recent: Donation[];
  } | null;
  outreach: {
    supportBreakdown: { level: string; count: number }[];
    canvassByDay: { day: string; count: number }[];
    callsByDay: { day: string; count: number }[];
  };
  upcomingEvents: CampaignEvent[];
  recentActivity: {
    kind: "donation" | "canvass" | "call" | "event" | "task";
    label: string;
    sub: string;
    at: string;
  }[];
  precincts: { name: string; supporters: number; contacted: number; total: number }[];
}

export const SUPPORT_LEVELS: { value: SupportLevel; label: string; color: string }[] = [
  { value: "strong-support", label: "Strong Support", color: "emerald" },
  { value: "lean-support", label: "Lean Support", color: "lime" },
  { value: "undecided", label: "Undecided", color: "amber" },
  { value: "lean-oppose", label: "Lean Oppose", color: "orange" },
  { value: "strong-oppose", label: "Strong Oppose", color: "red" },
  { value: "unknown", label: "Unknown", color: "slate" },
];

export const SUPPORT_SOURCE_LABELS: Record<string, string> = {
  manual: "manual edit",
  canvass: "canvass",
  call: "phone call",
};

/** Issue tags a canvasser or caller can record, stored as the value. */
export const ISSUES: { value: string; label: string }[] = [
  { value: "housing", label: "Housing" },
  { value: "schools", label: "Schools" },
  { value: "public-safety", label: "Public safety" },
  { value: "budget", label: "Budget" },
  { value: "parks", label: "Parks" },
  { value: "transit", label: "Transit" },
];

export const issueLabel = (value: string) => ISSUES.find((i) => i.value === value)?.label ?? value;

/** Party codes stored on voters, with the words shown to people. Imported county codes outside this list display as stored. */
export const PARTIES: { value: string; label: string }[] = [
  { value: "Dem", label: "Democratic" },
  { value: "Rep", label: "Republican" },
  { value: "Ind", label: "Independent" },
  { value: "Green", label: "Green" },
  { value: "Lib", label: "Libertarian" },
  { value: "NPP", label: "No party" },
];

export const partyLabel = (party: string) => PARTIES.find((p) => p.value === party)?.label ?? party;
