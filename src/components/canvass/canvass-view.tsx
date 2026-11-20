"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DoorOpen, Home, CheckCircle2, MapPin, Loader2, Plus } from "lucide-react";
import { SupportBadge } from "@/components/common/badges";
import { StatCard } from "@/components/common/stat-card";
import { useState } from "react";
import { toast } from "sonner";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CanvassLog, Volunteer } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useClaims } from "@/lib/claims";
import { ActingAsPicker } from "@/components/common/acting-as-picker";
import { useVoters } from "@/lib/voters";
import { useVolunteers } from "@/lib/volunteers";
import { LogCanvassDialog, OUTCOME_INFO } from "@/components/canvass/log-canvass-dialog";
import { WalkListCard, type Door, type DoorVoter } from "@/components/canvass/walk-list-card";

interface CanvassLogRow extends CanvassLog {
  household?: { address: string } | null;
  voter?: (CanvassLog["voter"] & { precinct?: { name: string } | null }) | null;
}


export function CanvassView() {
  const qc = useQueryClient();
  
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [logOpen, setLogOpen] = useState(false);
  const [activeVolunteerId, setActiveVolunteerId] = useState("");
  // The voter claimed from the walk list, and their door's voters for the log dialog.
  const [claimed, setClaimed] = useState<{ voterId: string; doorVoters: DoorVoter[] } | null>(null);
  const campaignId = useApp((s) => s.currentCampaignId);

  const params = new URLSearchParams();
  if (campaignId) params.set("campaignId", campaignId);
  if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);

  const { data: logsData, isLoading } = useQuery({
    queryKey: ["canvass-logs", params.toString()],
    queryFn: async (): Promise<{ items: CanvassLogRow[] }> => (await fetch(`/api/canvass?${params}`)).json(),
    enabled: !!campaignId,
    refetchInterval: 10_000,
  });
  const logs: CanvassLogRow[] = logsData?.items ?? [];

  // Voters to pick from when logging without claiming a door first.
  const { data: votersData } = useVoters(campaignId, { limit: "200" });
  const voters = votersData?.items ?? [];

  const { data: volunteersData } = useVolunteers(campaignId);
  const volunteers: Volunteer[] = volunteersData?.items ?? [];

  const { claimedByOthers, claim, release } = useClaims("canvass", campaignId, activeVolunteerId);

  async function claimVoter(voter: DoorVoter, door: Door) {
    if (!activeVolunteerId) {
      toast.error("Select who's canvassing first");
      return;
    }
    if (claimedByOthers.has(voter.id)) return;
    const r = await claim(voter.id, activeVolunteerId);
    if (r.status === 409) {
      const body = await r.json();
      toast.error(`Already being knocked by ${body.claimedBy}`);
      return;
    }
    setClaimed({ voterId: voter.id, doorVoters: door.voters });
    setLogOpen(true);
  }

  function releaseClaim() {
    if (!claimed || !activeVolunteerId) return;
    release(claimed.voterId, activeVolunteerId);
    setClaimed(null);
  }

  // Summary
  const total = logs.length;
  // A door is a household; voters without one count as their own door.
  const doors = new Set(logs.map((l) => l.householdId ?? l.voterId ?? l.id)).size;
  const notHome = logs.filter((l) => l.outcome === "not-home").length;
  const contacted = logs.filter((l) => l.outcome === "contacted").length;
  const yardSigns = logs.filter((l) => l.yardSign).length;
  const contactRate = total > 0 ? (contacted / total) * 100 : 0;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Who's canvassing */}
      <ActingAsPicker label="Canvassing as" campaignId={campaignId} value={activeVolunteerId} onChange={setActiveVolunteerId} />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={DoorOpen} label="Doors knocked" value={doors} sub={`${total} contact attempts`} accent="violet" />
        <StatCard icon={CheckCircle2} label="Contact rate" value={`${contactRate.toFixed(0)}%`} sub={`${contacted} contacts`} accent="emerald" />
        <StatCard icon={Home} label="Not home" value={notHome} sub="Try again later" accent="amber" />
        <StatCard icon={MapPin} label="Yard signs placed" value={yardSigns} sub="Via canvass" accent="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <WalkListCard campaignId={campaignId} claimedByOthers={claimedByOthers} onClaim={claimVoter} />

        {/* Canvass log table */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Canvass Activity Log</CardTitle>
              <CardDescription className="text-xs">Recent door-knock outcomes</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="All outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outcomes</SelectItem>
                  {Object.entries(OUTCOME_INFO).map(([k, info]) => (
                    <SelectItem key={k} value={k}>{info.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8" onClick={() => setLogOpen(true)}>
                <Plus className="size-3.5 mr-1" /> Log
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[560px] overflow-y-auto scroll-area-thin">
              {isLoading ? (
                <div className="py-12 text-center"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No canvass logs yet.</div>
              ) : (
                logs.map((l) => {
                  const info = OUTCOME_INFO[l.outcome] ?? OUTCOME_INFO["not-home"];
                  const Icon = info.icon;
                  return (
                    <div key={l.id} className="flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-accent/30">
                      <div className={cn("size-7 rounded-md grid place-items-center flex-shrink-0", info.color)}>
                        <Icon className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {l.voter ? `${l.voter.firstName} ${l.voter.lastName}` : "Unknown voter"}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 h-4">{info.label}</Badge>
                          {l.supportLevel && <SupportBadge level={l.supportLevel} />}
                          {l.yardSign && <Badge variant="outline" className="text-[10px] py-0 h-4 bg-amber-50">Yard sign</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          {l.household?.address && <span className="flex items-center gap-0.5"><MapPin className="size-3" />{l.household.address}</span>}
                          {l.voter?.precinct?.name && <span>· {l.voter.precinct.name}</span>}
                          {l.volunteer && <span>· {l.volunteer.firstName} {l.volunteer.lastName}</span>}
                          {l.issuePriority && <span>· issue: {l.issuePriority}</span>}
                        </div>
                        {l.notes && (
                          <div className="text-[11px] mt-1 text-foreground/80 italic bg-muted/30 px-2 py-1 rounded">
                            "{l.notes}"
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/70 mt-1">{relativeTime(l.contactedAt)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Log outcome dialog */}
      <LogCanvassDialog
        key={claimed?.voterId ?? "manual"}
        open={logOpen}
        onOpenChange={(o) => {
          setLogOpen(o);
          if (!o) releaseClaim();
        }}
        voters={claimed?.doorVoters ?? voters}
        volunteers={volunteers}
        defaultVoterId={claimed?.voterId}
        volunteerId={activeVolunteerId}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["canvass-logs"] });
          qc.invalidateQueries({ queryKey: ["voters"] });
          qc.invalidateQueries({ queryKey: ["walk-lists"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          toast("Canvass outcome logged", { duration: 1500 });
          setLogOpen(false);
          releaseClaim();
        }}
      />
    </div>
  );
}
