"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Users,
  Filter,
  Check,
  Phone,
  Mail,
  Loader2,
  Plus,
  Upload,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
} from "lucide-react";
import { PersonAvatar } from "@/components/common/person-avatar";
import { SupportBadge, PartyBadge } from "@/components/common/badges";
import { PARTIES, SUPPORT_LEVELS, type Voter } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useCurrentRole } from "@/lib/memberships";
import { useVoters } from "@/lib/voters";
import { VoterDetailSheet, type SaveResult } from "@/components/voters/voter-detail-sheet";
import { AddVoterDialog } from "@/components/voters/add-voter-dialog";
import { ImportVotersDialog } from "@/components/voters/import-voters-dialog";

interface VoterRow extends Voter {
  precinct?: { name: string; code: string } | null;
  household?: { address: string } | null;
  /** `donations` is only present for campaign owners. */
  _count?: { callLogs: number; canvassLogs: number; donations?: number };
}

interface Precinct {
  id: string;
  name: string;
}

type SortKey = "name" | "precinct";

const PAGE_SIZE = 50;

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function votedYears(v: Voter) {
  return [v.votedIn2024 && "2024", v.votedIn2022 && "2022", v.votedIn2020 && "2020"].filter(Boolean).join(", ");
}

export function VotersView() {
  const qc = useQueryClient();
  const campaignId = useApp((s) => s.currentCampaignId);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [supportFilter, setSupportFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [precinctFilter, setPrecinctFilter] = useState("all");
  const [contactedOnly, setContactedOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<VoterRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const isOwner = useCurrentRole() === "owner";

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: precinctsData } = useQuery({
    queryKey: ["precincts", campaignId],
    queryFn: async (): Promise<{ items: Precinct[] }> => (await fetch(`/api/precincts?campaignId=${campaignId}`)).json(),
    enabled: !!campaignId,
  });

  const filters: Record<string, string> = {};
  if (debouncedQ) filters.q = debouncedQ;
  if (supportFilter !== "all") filters.support = supportFilter;
  if (partyFilter !== "all") filters.party = partyFilter;
  if (precinctFilter !== "all") filters.precinctId = precinctFilter;
  if (contactedOnly) filters.contacted = "1";
  const hasFilters = Object.keys(filters).length > 0 || q !== "";

  const { data, isLoading, isPlaceholderData } = useVoters(
    campaignId,
    { ...filters, sort: sort.key, dir: sort.dir, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) },
    { staleTime: 10_000, keepPrevious: true }
  );

  const voters: VoterRow[] = (data?.items as VoterRow[] | undefined) ?? [];
  const total = data?.total ?? 0;
  const noVotersYet = !isLoading && !hasFilters && data?.total === 0;
  const firstShown = page * PAGE_SIZE + 1;
  const lastShown = page * PAGE_SIZE + voters.length;

  // Every filter change starts again from the first page.
  function filterBy<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(0);
    };
  }

  function clearFilters() {
    setQ("");
    setDebouncedQ("");
    setSupportFilter("all");
    setPartyFilter("all");
    setPrecinctFilter("all");
    setContactedOnly(false);
    setPage(0);
  }

  function sortBy(key: SortKey) {
    setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
    setPage(0);
  }

  // A network failure resolves to a failed response, so the sheet shows its fallback error.
  async function sendVoter(method: "PATCH" | "DELETE", body: object): SaveResult {
    const r = await fetch("/api/voters", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => new Response(null, { status: 503 }));
    if (r.ok) {
      qc.invalidateQueries({ queryKey: ["voters"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
    return r;
  }

  async function updateVoter(id: string, patch: Partial<Voter>): SaveResult {
    const r = await sendVoter("PATCH", { id, ...patch });
    if (!r.ok) return r;
    const updated: Voter = await r.json();
    toast("Voter updated", { duration: 1500 });
    // A new street address can take the voter out of their household.
    setSelected((s) => (s?.id === id ? { ...s, ...updated, household: updated.householdId ? s.household : null } : s));
    return r;
  }

  async function deleteVoter(voter: Voter): SaveResult {
    const r = await sendVoter("DELETE", { id: voter.id });
    if (!r.ok) return r;
    toast(`Deleted ${voter.firstName} ${voter.lastName}`, { duration: 1500 });
    setSelected(null);
    return r;
  }

  const dialogs = (
    <>
      <AddVoterDialog open={addOpen} onOpenChange={setAddOpen} campaignId={campaignId} precincts={precinctsData?.items ?? []} />
      {isOwner && <ImportVotersDialog open={importOpen} onOpenChange={setImportOpen} campaignId={campaignId} />}
    </>
  );

  if (noVotersYet) {
    return (
      <div className="p-4 md:p-6">
        <Card className="p-8 md:p-12 text-center">
          <Users className="size-6 mx-auto text-muted-foreground" aria-hidden />
          <h2 className="mt-3 text-base font-semibold">No voters yet</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            {isOwner
              ? "Import your voter list from a CSV, or add voters one at a time."
              : "Your campaign owner can import the voter list. You can add voters one at a time."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {isOwner ? (
              <>
                <Button type="button" onClick={() => setImportOpen(true)}>
                  <Upload className="size-4 mr-1" aria-hidden /> Import voter list
                </Button>
                <Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus className="size-4 mr-1" aria-hidden /> Add voter
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => setAddOpen(true)}>
                <Plus className="size-4 mr-1" aria-hidden /> Add voter
              </Button>
            )}
          </div>
        </Card>
        {dialogs}
      </div>
    );
  }

  const control = "h-11 md:h-9";
  // SelectTrigger sets its height through data-size, so override that selector.
  const selectControl = "data-[size=default]:h-11 md:data-[size=default]:h-9";

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <div className="relative md:flex-1 md:min-w-[200px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
            <Input
              aria-label="Search voters"
              placeholder="Search by name, phone, address, or notes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={cn("pl-9", control)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
            <Select value={supportFilter} onValueChange={filterBy(setSupportFilter)}>
              <SelectTrigger aria-label="Support level" className={cn("w-full md:w-[160px]", selectControl)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All support</SelectItem>
                {SUPPORT_LEVELS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={partyFilter} onValueChange={filterBy(setPartyFilter)}>
              <SelectTrigger aria-label="Party" className={cn("w-full md:w-[150px]", selectControl)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All parties</SelectItem>
                {PARTIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={precinctFilter} onValueChange={filterBy(setPrecinctFilter)}>
              <SelectTrigger aria-label="Precinct" className={cn("w-full md:w-[180px]", selectControl)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All precincts</SelectItem>
                {(precinctsData?.items ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              aria-pressed={contactedOnly}
              className={cn(control, contactedOnly && "bg-accent border-ring")}
              onClick={() => filterBy(setContactedOnly)(!contactedOnly)}
            >
              {contactedOnly ? <Check className="size-4" aria-hidden /> : <Filter className="size-4" aria-hidden />}
              Contacted
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 md:ml-auto">
            {hasFilters && (
              <Button type="button" variant="ghost" className={control} onClick={clearFilters}>
                <X className="size-4" aria-hidden /> Clear
              </Button>
            )}
            {isOwner && (
              <Button type="button" variant="outline" className={control} onClick={() => setImportOpen(true)}>
                <Upload className="size-4" aria-hidden /> Import CSV
              </Button>
            )}
            <Button type="button" className={control} onClick={() => setAddOpen(true)}>
              <Plus className="size-4" aria-hidden /> Add voter
            </Button>
          </div>
        </div>
      </Card>

      {/* Voters */}
      <Card className="overflow-hidden gap-0 py-0">
        {isLoading && !data ? (
          <div className="px-4 py-12 text-center text-muted-foreground" role="status">
            <Loader2 className="size-5 animate-spin mx-auto" aria-hidden />
            <span className="sr-only">Loading voters</span>
          </div>
        ) : voters.length === 0 ? (
          <div className="px-4 py-12 text-center" role="status">
            <p className="text-sm text-muted-foreground">
              {Object.keys(filters).length === 1 && filters.q
                ? `No voters match “${filters.q}”.`
                : "No voters match this search and these filters."}
            </p>
            <Button type="button" variant="outline" className={cn("mt-3", control)} onClick={clearFilters}>
              Clear search and filters
            </Button>
          </div>
        ) : (
          <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
            {/* Phone: one stacked row per voter */}
            <ul className="divide-y md:hidden">
              {voters.map((v) => (
                <li key={v.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setSelected(v)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:bg-accent"
                  >
                    <span aria-hidden><PersonAvatar first={v.firstName} last={v.lastName} size="sm" /></span>
                    <span className="block min-w-0 flex-1">
                      <span className="block font-medium truncate">{v.firstName} {v.lastName}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {v.household?.address ?? v.registeredAddress ?? "No address"}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        <SupportBadge level={v.supportLevel} />
                        <PartyBadge party={v.partyAffiliation} />
                      </span>
                    </span>
                  </button>
                  {v.phone && (
                    <a
                      href={`tel:${v.phone}`}
                      aria-label={`Call ${v.firstName} ${v.lastName}`}
                      className="mr-2 grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Phone className="size-4" aria-hidden />
                    </a>
                  )}
                </li>
              ))}
            </ul>

            {/* Laptop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Voters, sorted by {sort.key === "name" ? "last name" : "precinct"}. Choose a name to open the voter&apos;s record.
                </caption>
                <thead>
                  <tr className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <SortHeader label="Voter" active={sort.key === "name"} dir={sort.dir} onSort={() => sortBy("name")} />
                    <th scope="col" className="text-left font-medium px-4 py-2.5">Contact</th>
                    <SortHeader label="Precinct" className="hidden lg:table-cell" active={sort.key === "precinct"} dir={sort.dir} onSort={() => sortBy("precinct")} />
                    <th scope="col" className="text-left font-medium px-4 py-2.5">Support</th>
                    <th scope="col" className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Outreach</th>
                    <th scope="col" className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {voters.map((v) => {
                    const calls = v._count?.callLogs ?? 0;
                    const doors = v._count?.canvassLogs ?? 0;
                    const gifts = v._count?.donations;
                    const voted = votedYears(v);
                    return (
                      <tr
                        key={v.id}
                        className="border-b last:border-b-0 hover:bg-accent/30 cursor-pointer transition-colors"
                        onClick={() => setSelected(v)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <PersonAvatar first={v.firstName} last={v.lastName} size="sm" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected(v);
                                }}
                                className="font-medium truncate text-left rounded-sm hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                              >
                                {v.firstName} {v.lastName}
                              </button>
                              <div className="text-xs text-muted-foreground truncate">
                                {v.household?.address ?? v.registeredAddress ?? "No address"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {v.phone && <div className="flex items-center gap-1 tabular-nums"><Phone className="size-3" aria-hidden />{v.phone}</div>}
                            {v.email && <div className="flex items-center gap-1 truncate"><Mail className="size-3" aria-hidden />{v.email}</div>}
                            {!v.phone && !v.email && "—"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell">
                          <div className="whitespace-nowrap">{v.precinct?.name ?? "—"}</div>
                          {v.precinct?.code && <div className="text-xs text-muted-foreground">{v.precinct.code}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <SupportBadge level={v.supportLevel} />
                            <PartyBadge party={v.partyAffiliation} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {calls + doors + (gifts ?? 0) === 0 ? (
                            "None yet"
                          ) : (
                            <>
                              {plural(calls, "call", "calls")} · {plural(doors, "door", "doors")}
                              {gifts !== undefined && gifts > 0 && <> · {plural(gifts, "gift", "gifts")}</>}
                            </>
                          )}
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell">
                          {voted && <div className="text-xs text-muted-foreground">Voted {voted}</div>}
                          {(v.volunteer || v.hasYardSign || v.tags) && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {v.volunteer && <Badge variant="outline" className="text-xs py-0 h-5">Volunteer</Badge>}
                              {v.hasYardSign && <Badge variant="outline" className="text-xs py-0 h-5">Yard sign</Badge>}
                              {v.tags?.split(",").map((t) => (
                                <Badge key={t} variant="secondary" className="text-xs py-0 h-5">{t}</Badge>
                              ))}
                            </div>
                          )}
                          {!voted && !v.volunteer && !v.hasYardSign && !v.tags && <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {total > 0 && voters.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t text-xs text-muted-foreground bg-muted/20">
            <span className="tabular-nums" aria-live="polite">
              Showing {firstShown.toLocaleString()}–{lastShown.toLocaleString()} of {plural(total, "voter", "voters")}
            </span>
            {total > PAGE_SIZE && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 md:h-8"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 md:h-8"
                  disabled={lastShown >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <VoterDetailSheet
        voter={selected}
        onClose={() => setSelected(null)}
        onUpdate={updateVoter}
        onDelete={isOwner ? deleteVoter : undefined}
      />
      {dialogs}
    </div>
  );
}

function SortHeader({ label, active, dir, onSort, className }: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onSort: () => void;
  className?: string;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn("text-left font-medium px-4 py-2.5", className)}
    >
      <button
        type="button"
        onClick={onSort}
        className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 uppercase tracking-wider hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {label}
        <Icon className={cn("size-3", !active && "opacity-50")} aria-hidden />
      </button>
    </th>
  );
}
