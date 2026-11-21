"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, Loader2, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, SupportBadge } from "@/components/common/badges";
import { OUTCOME_INFO } from "@/components/canvass/log-canvass-dialog";
import { relativeTime } from "@/lib/format";
import { useStoredState } from "@/lib/use-stored-state";
import { cn } from "@/lib/utils";
import type { Voter } from "@/lib/types";
import { doorIsDone, type Door, type DoorVisit } from "@/lib/walk-list";

const PAGE_SIZE = 25;

interface WalkListSummary {
  /** A precinct id, or NO_PRECINCT for voters without one. */
  precinctId: string;
  name: string;
  doorCount: number;
}

export type DoorVoter = Pick<Voter, "id" | "firstName" | "lastName" | "supportLevel" | "campaignId" | "householdId"> & {
  household: { address: string } | null;
};

export type WalkDoor = Door<DoorVoter> & { lastVisit: DoorVisit | null };

interface DoorActions {
  claimedByOthers: Map<string, string>;
  onClaim: (voter: DoorVoter, door: WalkDoor) => void;
  /** One tap: log "Not home" for the whole door without opening the log. */
  onNotHome: (door: WalkDoor) => void;
  /** The door whose one-tap save is in flight. */
  pendingDoorId: string | null;
  /** Who's canvassing, for the progress bar; empty until someone is chosen. */
  volunteerName: string;
}

const doorsLabel = (n: number) => `${n.toLocaleString()} ${n === 1 ? "door" : "doors"}`;

function DoorSkeleton() {
  return (
    <ul aria-hidden className="border-t">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="border-b last:border-b-0 px-4 py-3 space-y-2.5">
          <div className="h-4 w-2/5 rounded bg-muted animate-pulse" />
          <div className="h-9 rounded-md bg-muted/60 animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

export function WalkListCard({ campaignId, ...actions }: DoorActions & { campaignId: string | null }) {
  const [picked, setPicked] = useStoredState(`cg:walk-list:${campaignId}`);

  const { data, isLoading } = useQuery({
    queryKey: ["walk-lists", campaignId],
    queryFn: async (): Promise<{ items: WalkListSummary[] }> =>
      (await fetch(`/api/walk-lists?campaignId=${campaignId}`)).json(),
    enabled: !!campaignId,
  });
  const lists = data?.items ?? [];
  // Show the first list until the canvasser picks one, or if the picked one empties out.
  const list = lists.find((l) => l.precinctId === picked) ?? lists[0];

  return (
    // No overflow clipping on phones: it would stop the progress bar sticking to the bottom of the screen.
    <Card className="lg:col-span-1 gap-0 py-0 md:overflow-hidden">
      <CardHeader className="pt-6 pb-3">
        <CardTitle className="text-base">Walk list</CardTitle>
        <CardDescription className="text-xs">
          Every door in a precinct, in street order. Tap a name to log the visit; nobody else can take that door while you do.
        </CardDescription>
        {lists.length > 0 && (
          <div className="pt-2">
            <Label htmlFor="walk-list-precinct" className="text-xs">Precinct</Label>
            <Select value={list?.precinctId} onValueChange={setPicked}>
              <SelectTrigger id="walk-list-precinct" className="mt-1 w-full data-[size=default]:h-11 md:data-[size=default]:h-9">
                <SelectValue placeholder="Choose a precinct" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((l) => (
                  <SelectItem key={l.precinctId} value={l.precinctId} className="min-h-11 md:min-h-0">
                    {l.name} · {doorsLabel(l.doorCount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <DoorSkeleton />
        ) : campaignId && list ? (
          // Keyed so switching precincts starts at the first page.
          <WalkListDoors key={list.precinctId} campaignId={campaignId} precinct={list.precinctId} precinctName={list.name} {...actions} />
        ) : (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No walk lists yet. They appear once the campaign has voters.</p>
        )}
      </CardContent>
    </Card>
  );
}

function WalkListDoors({ campaignId, precinct, precinctName, claimedByOthers, onClaim, onNotHome, pendingDoorId, volunteerName }: DoorActions & {
  campaignId: string;
  precinct: string;
  precinctName: string;
}) {
  const [page, setPage] = useState(0);
  // Finished doors fold away; a canvasser can reopen one to log another visit.
  const [reopened, setReopened] = useState<Set<string>>(new Set());
  const { data, isPlaceholderData } = useQuery({
    queryKey: ["walk-lists", campaignId, precinct, page],
    queryFn: async (): Promise<{ items: WalkDoor[]; total: number; done: number }> => {
      const params = new URLSearchParams({
        campaignId,
        precinctId: precinct,
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      return (await fetch(`/api/walk-lists/doors?${params}`)).json();
    },
    placeholderData: keepPreviousData,
  });
  if (!data) return <DoorSkeleton />;

  const doors = data.items;
  const lastShown = page * PAGE_SIZE + doors.length;

  return (
    <>
      <ul className={cn("border-t transition-opacity md:max-h-[560px] md:overflow-y-auto scroll-area-thin", isPlaceholderData && "opacity-60")}>
        {doors.map((door) => {
          // A claim covers the whole door, so any claimed housemate marks it.
          const claimedBy = door.voters.map((v) => claimedByOthers.get(v.id)).find(Boolean);
          const done = doorIsDone(door);
          const open = !done || reopened.has(door.id);
          const visit = door.lastVisit && OUTCOME_INFO[door.lastVisit.outcome];
          return (
            <li key={door.id} className={cn("border-b last:border-b-0 px-4 py-2", done && "bg-muted/30")}>
              <div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                <MapPin className="size-3.5 text-muted-foreground flex-shrink-0" aria-hidden />
                <span className={cn("flex-1 min-w-0 truncate", done && "text-muted-foreground")}>{door.address ?? "No address"}</span>
                {visit && (
                  <StatusBadge color={visit.color}>
                    <span>{visit.label} · <span className="tabular-nums">{relativeTime(door.lastVisit!.contactedAt)}</span></span>
                  </StatusBadge>
                )}
                {claimedBy && <StatusBadge color="slate">With {claimedBy}</StatusBadge>}
              </div>
              {open ? (
                <div className="mt-1 space-y-1">
                  {door.voters.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onClaim(v, door)}
                      disabled={!!claimedBy}
                      className={cn(
                        "flex w-full min-h-11 items-center gap-2 rounded-md px-2 text-left text-sm",
                        claimedBy ? "opacity-60 cursor-not-allowed" : "hover:bg-accent"
                      )}
                    >
                      <span className="sr-only">Log a visit with </span>
                      <span className="flex-1 truncate">{v.firstName} {v.lastName}</span>
                      {claimedBy && <span className="sr-only">, {claimedBy} has this door open</span>}
                      <SupportBadge level={v.supportLevel} />
                    </button>
                  ))}
                  {!done && !claimedBy && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11 w-full md:h-8"
                      disabled={pendingDoorId === door.id}
                      onClick={() => onNotHome(door)}
                    >
                      {pendingDoorId === door.id && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                      Nobody home
                      <span className="sr-only"> at {door.address ?? "this door"}</span>
                    </Button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setReopened((s) => new Set(s).add(door.id))}
                  className="mt-1 flex min-h-11 w-full items-center gap-1 rounded-md px-2 text-left text-sm text-muted-foreground hover:bg-accent md:min-h-8"
                >
                  <ChevronDown className="size-4" aria-hidden />
                  Log another visit
                  <span className="sr-only"> at {door.address ?? "this door"}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {data.total > 0 && (
        <div className="sticky bottom-0 z-10 rounded-b-xl border-t bg-card px-4 py-2 text-xs text-muted-foreground shadow-[0_-4px_12px_-6px_rgb(0_0_0/0.15)] md:static md:rounded-none md:bg-muted/20 md:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 truncate">
              {volunteerName ? <>As <span className="font-medium text-foreground">{volunteerName}</span> · </> : null}
              {precinctName}
            </span>
            <span className="tabular-nums font-medium text-foreground" aria-live="polite">
              {data.done.toLocaleString()} of {doorsLabel(data.total)} done
            </span>
          </div>
          {data.total > PAGE_SIZE && (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="tabular-nums">
                Showing {(page * PAGE_SIZE + 1).toLocaleString()}–{lastShown.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-11 md:h-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-11 md:h-8" disabled={lastShown >= data.total} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
