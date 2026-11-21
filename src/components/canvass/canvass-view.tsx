"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DoorOpen, Home, CheckCircle2, MapPin, Plus } from "lucide-react";
import { StatusBadge, SupportBadge } from "@/components/common/badges";
import { StatCard } from "@/components/common/stat-card";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { relativeTime } from "@/lib/format";
import { issueLabel, type CanvassLog, type Volunteer } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useClaims } from "@/lib/claims";
import { ActingAsPicker } from "@/components/common/acting-as-picker";
import { useVolunteers } from "@/lib/volunteers";
import { useSavingAction } from "@/lib/use-saving-action";
import { useStoredState } from "@/lib/use-stored-state";
import { LogCanvassDialog, OUTCOME_INFO } from "@/components/canvass/log-canvass-dialog";
import { WalkListCard, type DoorVoter, type WalkDoor } from "@/components/canvass/walk-list-card";

interface CanvassLogRow extends CanvassLog {
  household?: { address: string } | null;
  voter?: (CanvassLog["voter"] & { precinct?: { name: string } | null }) | null;
}

interface CanvassSummary {
  attempts: number;
  doors: number;
  contacted: number;
  notHome: number;
  yardSigns: number;
}

const CHOOSE_VOLUNTEER = "Choose who's canvassing before you log a door.";

export function CanvassView() {
  const qc = useQueryClient();
  const { run } = useSavingAction();
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [logOpen, setLogOpen] = useState(false);
  // Bumped on every open so the dialog starts empty each time.
  const [dialogSession, setDialogSession] = useState(0);
  const [volunteerError, setVolunteerError] = useState("");
  const [pendingDoorId, setPendingDoorId] = useState<string | null>(null);
  // The voter claimed from the walk list, and their door's voters for the log dialog.
  const [claimed, setClaimed] = useState<{ voterId: string; doorVoters: DoorVoter[] } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const campaignId = useApp((s) => s.currentCampaignId);

  // Remembered per campaign, so a reload in the field keeps who's canvassing.
  const [storedVolunteerId, setStoredVolunteerId] = useStoredState(`cg:canvass-as:${campaignId}`);
  const { data: volunteersData } = useVolunteers(campaignId);
  const volunteers: Volunteer[] = volunteersData?.items ?? [];
  const activeVolunteer = volunteers.find((v) => v.id === storedVolunteerId);
  const activeVolunteerId = activeVolunteer?.id ?? "";

  const params = new URLSearchParams();
  if (campaignId) params.set("campaignId", campaignId);
  if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);

  const { data: logsData, isLoading } = useQuery({
    queryKey: ["canvass-logs", params.toString()],
    queryFn: async (): Promise<{ items: CanvassLogRow[]; summary: CanvassSummary }> => (await fetch(`/api/canvass?${params}`)).json(),
    enabled: !!campaignId,
    refetchInterval: 10_000,
  });
  const logs: CanvassLogRow[] = logsData?.items ?? [];
  const summary = logsData?.summary;

  const { claimedByOthers, claim, release } = useClaims("canvass", campaignId, activeVolunteerId);

  function chooseVolunteer(id: string) {
    setStoredVolunteerId(id);
    setVolunteerError("");
  }

  /** Points at the picker instead of a toast that may land off screen. */
  function requireVolunteer(): boolean {
    if (activeVolunteer) return true;
    setVolunteerError(CHOOSE_VOLUNTEER);
    pickerRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    pickerRef.current?.querySelector<HTMLElement>("button, [role=combobox]")?.focus({ preventScroll: true });
    return false;
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["canvass-logs"] });
    qc.invalidateQueries({ queryKey: ["voters"] });
    qc.invalidateQueries({ queryKey: ["walk-lists"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function undo(log: CanvassLog) {
    const r = await fetch(`/api/canvass?id=${log.id}&campaignId=${log.campaignId}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) {
      const body = await r?.json().catch(() => null);
      toast.error("Couldn't undo", { description: body?.error ?? "Check your connection and try again." });
      return;
    }
    refresh();
    toast("Visit removed");
  }

  // Visits that changed the voter's record can't be undone here (the API refuses them).
  function confirmSaved(log: CanvassLog, message: string) {
    refresh();
    const undoable = !log.supportLevel && !log.yardSign;
    toast.success(message, {
      duration: 6000,
      action: undoable ? { label: "Undo", onClick: () => undo(log) } : undefined,
    });
  }

  async function claimVoter(voter: DoorVoter, door: WalkDoor) {
    if (!requireVolunteer()) return;
    if (claimedByOthers.has(voter.id)) return;
    const r = await claim(voter.id, activeVolunteerId);
    if (r.status === 409) {
      const body = await r.json();
      toast.error(`${body.claimedBy} has this door open`);
      return;
    }
    setClaimed({ voterId: voter.id, doorVoters: door.voters });
    setDialogSession((n) => n + 1);
    setLogOpen(true);
  }

  async function notHome(door: WalkDoor) {
    if (!requireVolunteer()) return;
    const [first] = door.voters;
    setPendingDoorId(door.id);
    let res: Response | undefined;
    await run(
      async () =>
        (res = await fetch("/api/canvass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // A household door is logged against the household, not one resident.
          body: JSON.stringify({
            householdId: first.householdId ?? undefined,
            voterId: first.householdId ? undefined : first.id,
            volunteerId: activeVolunteerId,
            campaignId: first.campaignId,
            outcome: "not-home",
          }),
        })),
      {
        onError: async (r) => {
          const body = await r.json().catch(() => null);
          toast.error("Couldn't save this visit", { description: body?.error ?? "Try again in a moment." });
        },
        onSuccess: async () => confirmSaved(await res!.json(), `Not home at ${door.address ?? "this door"}`),
      }
    );
    setPendingDoorId(null);
  }

  function openManualLog() {
    if (!requireVolunteer()) return;
    setClaimed(null);
    setDialogSession((n) => n + 1);
    setLogOpen(true);
  }

  function releaseClaim() {
    if (!claimed || !activeVolunteerId) return;
    release(claimed.voterId, activeVolunteerId);
    setClaimed(null);
  }

  const contactRate = summary && summary.attempts > 0 ? (summary.contacted / summary.attempts) * 100 : 0;
  const filterLabel = OUTCOME_INFO[outcomeFilter]?.label;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div ref={pickerRef}>
        <ActingAsPicker label="Canvassing as" campaignId={campaignId} value={activeVolunteerId} onChange={chooseVolunteer} error={volunteerError} />
      </div>

      {/* Campaign-wide totals are for the manager at a desk; on a phone the walk list comes first. */}
      {summary && (
        <div className="hidden md:grid md:grid-cols-4 gap-3">
          <StatCard icon={DoorOpen} label="Doors visited" value={summary.doors} sub={`${summary.attempts} visits logged`} accent="violet" />
          <StatCard icon={CheckCircle2} label="Contact rate" value={`${contactRate.toFixed(0)}%`} sub={`${summary.contacted} conversations`} accent="emerald" />
          <StatCard icon={Home} label="Not home" value={summary.notHome} sub="Worth another knock" accent="amber" />
          <StatCard icon={MapPin} label="Yard signs requested" value={summary.yardSigns} sub="Asked for at the door" accent="rose" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <WalkListCard
          campaignId={campaignId}
          claimedByOthers={claimedByOthers}
          onClaim={claimVoter}
          onNotHome={notHome}
          pendingDoorId={pendingDoorId}
          volunteerName={activeVolunteer ? `${activeVolunteer.firstName} ${activeVolunteer.lastName}` : ""}
        />

        <Card className="hidden md:flex lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Recent visits</CardTitle>
              <CardDescription className="text-xs">Newest first, across every precinct</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger aria-label="Filter by outcome" className="w-[150px] text-xs data-[size=default]:h-9">
                  <SelectValue placeholder="All outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outcomes</SelectItem>
                  {Object.entries(OUTCOME_INFO).map(([k, info]) => (
                    <SelectItem key={k} value={k}>{info.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-9" onClick={openManualLog}>
                <Plus className="size-3.5" aria-hidden /> Log a visit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[560px] overflow-y-auto scroll-area-thin border-t">
              {isLoading ? (
                <LogSkeleton />
              ) : logs.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {filterLabel
                    ? `No “${filterLabel}” visits yet.`
                    : "No visits logged yet. Pick a precinct and tap a door to log the first one."}
                </p>
              ) : (
                <ul>
                  {logs.map((l) => {
                    const info = OUTCOME_INFO[l.outcome] ?? OUTCOME_INFO["not-home"];
                    const who = l.voter ? `${l.voter.firstName} ${l.voter.lastName}` : (l.household?.address ?? "Unknown door");
                    return (
                      <li key={l.id} className="px-4 py-3 border-b last:border-b-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{who}</span>
                          <StatusBadge color={info.color}>{info.label}</StatusBadge>
                          {l.supportLevel && <SupportBadge level={l.supportLevel} />}
                          {l.yardSign && <StatusBadge color="amber">Yard sign requested</StatusBadge>}
                          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{relativeTime(l.contactedAt)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                          {l.voter && l.household?.address && <span>{l.household.address}</span>}
                          {l.voter?.precinct?.name && <span>· {l.voter.precinct.name}</span>}
                          {l.volunteer && <span>· {l.volunteer.firstName} {l.volunteer.lastName}</span>}
                          {l.issuePriority && <span>· Issue: {issueLabel(l.issuePriority)}</span>}
                        </div>
                        {l.notes && <p className="text-xs mt-1.5 text-foreground/80 bg-muted/40 px-2 py-1 rounded">“{l.notes}”</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {activeVolunteer && (
        <LogCanvassDialog
          key={dialogSession}
          open={logOpen}
          onOpenChange={(o) => {
            setLogOpen(o);
            if (!o) releaseClaim();
          }}
          campaignId={campaignId}
          doorVoters={claimed?.doorVoters}
          defaultVoterId={claimed?.voterId}
          volunteer={activeVolunteer}
          onSaved={(log) => {
            confirmSaved(log, "Visit saved");
            setLogOpen(false);
            releaseClaim();
          }}
        />
      )}
    </div>
  );
}

function LogSkeleton() {
  return (
    <ul aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="px-4 py-3 border-b last:border-b-0 space-y-2">
          <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted/60 animate-pulse" />
        </li>
      ))}
    </ul>
  );
}
