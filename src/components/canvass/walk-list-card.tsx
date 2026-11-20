"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SupportBadge } from "@/components/common/badges";
import { cn } from "@/lib/utils";
import type { Voter } from "@/lib/types";

const PAGE_SIZE = 25;

interface WalkListSummary {
  precinctId: string | null;
  name: string;
  voterCount: number;
}

export type DoorVoter = Pick<Voter, "id" | "firstName" | "lastName" | "supportLevel" | "campaignId" | "householdId"> & {
  household: { address: string } | null;
};

export interface Door {
  id: string;
  address: string | null;
  voters: DoorVoter[];
}

interface ClaimProps {
  claimedByOthers: Map<string, string>;
  onClaim: (voter: DoorVoter, door: Door) => void;
}

const loading = (
  <div className="py-12 text-center"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></div>
);

export function WalkListCard({ campaignId, ...claimProps }: ClaimProps & { campaignId: string | null }) {
  const [picked, setPicked] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["walk-lists", campaignId],
    queryFn: async (): Promise<{ items: WalkListSummary[] }> =>
      (await fetch(`/api/walk-lists?campaignId=${campaignId}`)).json(),
    enabled: !!campaignId,
  });
  // The API's precinctId "none" is the "No precinct" walk list.
  const lists = (data?.items ?? []).map((l) => ({ ...l, key: l.precinctId ?? "none" }));
  // Show the first list until the canvasser picks one, or if the picked one empties out.
  const precinct = lists.find((l) => l.key === picked)?.key ?? lists[0]?.key;

  return (
    <Card className="lg:col-span-1 gap-0 py-0 overflow-hidden">
      <CardHeader className="pt-6 pb-3">
        <CardTitle className="text-base">Walk Lists</CardTitle>
        <CardDescription className="text-xs">Every door in a precinct, in street order</CardDescription>
        {lists.length > 0 && (
          <div className="pt-2">
            <Label htmlFor="walk-list-precinct" className="text-xs">Precinct</Label>
            <Select value={precinct} onValueChange={setPicked}>
              <SelectTrigger id="walk-list-precinct" className="mt-1 w-full data-[size=default]:h-11 md:data-[size=default]:h-9">
                <SelectValue placeholder="Choose a precinct" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((l) => (
                  <SelectItem key={l.key} value={l.key}>
                    {l.name} · {l.voterCount.toLocaleString()} {l.voterCount === 1 ? "voter" : "voters"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          loading
        ) : campaignId && precinct ? (
          // Keyed so switching precincts starts at the first page.
          <WalkListDoors key={precinct} campaignId={campaignId} precinct={precinct} {...claimProps} />
        ) : (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No walk lists yet. They appear once the campaign has voters.</p>
        )}
      </CardContent>
    </Card>
  );
}

function WalkListDoors({ campaignId, precinct, claimedByOthers, onClaim }: ClaimProps & {
  campaignId: string;
  precinct: string;
}) {
  const [page, setPage] = useState(0);
  const { data, isPlaceholderData } = useQuery({
    queryKey: ["walk-lists", campaignId, precinct, page],
    queryFn: async (): Promise<{ items: Door[]; total: number }> => {
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
  if (!data) return loading;

  const doors = data.items;
  const lastShown = page * PAGE_SIZE + doors.length;

  return (
    <>
      <ul className={cn("max-h-[560px] overflow-y-auto scroll-area-thin border-t transition-opacity", isPlaceholderData && "opacity-60")}>
        {doors.map((door) => {
          // A claim covers the whole door, so any claimed housemate marks it.
          const knocking = door.voters.map((v) => claimedByOthers.get(v.id)).find(Boolean);
          return (
            <li key={door.id} className="border-b last:border-b-0 px-4 py-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="size-3.5 text-muted-foreground flex-shrink-0" aria-hidden />
                <span className="flex-1 truncate">{door.address ?? "No address"}</span>
                {knocking && <Badge variant="outline" className="text-[10px] py-0 h-5">Knocking: {knocking}</Badge>}
              </div>
              {door.voters.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onClaim(v, door)}
                  disabled={!!knocking}
                  className={cn(
                    "flex w-full min-h-11 items-center gap-2 rounded-md px-2 text-left text-sm",
                    knocking ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/50"
                  )}
                >
                  <span className="flex-1 truncate">{v.firstName} {v.lastName}</span>
                  <SupportBadge level={v.supportLevel} />
                </button>
              ))}
            </li>
          );
        })}
      </ul>
      {data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t text-xs text-muted-foreground bg-muted/20">
          <span className="tabular-nums" aria-live="polite">
            {(page * PAGE_SIZE + 1).toLocaleString()}–{lastShown.toLocaleString()} of {data.total.toLocaleString()}{" "}
            {data.total === 1 ? "door" : "doors"}
          </span>
          {data.total > PAGE_SIZE && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="h-11 md:h-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-11 md:h-8" disabled={lastShown >= data.total} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
