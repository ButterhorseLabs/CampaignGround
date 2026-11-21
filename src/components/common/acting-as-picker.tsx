"use client";

import { useEffect, useId } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentRole } from "@/lib/memberships";
import { useVolunteers } from "@/lib/volunteers";
import { useSavingAction } from "@/lib/use-saving-action";
import type { Volunteer } from "@/lib/types";

/**
 * "Canvassing as" / "Calling as" control. Owners pick any volunteer; members
 * can only act as the roster entry linked to their own login (the API enforces
 * the same rule), so they see their name, or a button to add themselves.
 */
export function ActingAsPicker({ label, campaignId, value, onChange, error }: {
  label: string;
  campaignId: string | null;
  value: string;
  onChange: (volunteerId: string) => void;
  /** Shown under the picker, e.g. when someone taps a door before choosing who's canvassing. */
  error?: string;
}) {
  const id = useId();
  const qc = useQueryClient();
  const { saving, run } = useSavingAction();
  const role = useCurrentRole();
  const userId = useSession().data?.user.id;
  const { data, isLoading } = useVolunteers(campaignId);
  const volunteers: Volunteer[] = data?.items ?? [];
  const mine = userId ? volunteers.find((v) => v.userId === userId) : undefined;

  // Preselect the caller's own entry; members can't hold any other.
  useEffect(() => {
    if (mine && (role === "member" ? value !== mine.id : !value)) onChange(mine.id);
  }, [mine, role, value, onChange]);

  async function addSelf() {
    let res: Response | undefined;
    await run(
      async () => (res = await fetch("/api/volunteers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, self: true }),
      })),
      {
        failTitle: "Couldn't add you as a volunteer. Try again.",
        onSuccess: async () => {
          const v: Volunteer = await res!.json();
          await qc.invalidateQueries({ queryKey: ["volunteers", campaignId] });
          onChange(v.id);
        },
      }
    );
  }

  if (isLoading || !role) return null;

  if (role === "member" ? !mine : volunteers.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {role === "member"
            ? "You're not on the volunteer roster yet."
            : "No volunteers yet. Add yourself to start."}
        </span>
        <Button type="button" size="sm" variant="outline" className="h-11 md:h-8" onClick={addSelf} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <UserPlus className="size-3.5 mr-1" />}
          {role === "member" ? "Add me as a volunteer" : "Add yourself as a volunteer"}
        </Button>
      </div>
    );
  }

  if (role === "member") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium whitespace-nowrap">{label}</span>
        <span className="text-xs">{mine!.firstName} {mine!.lastName}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Label htmlFor={id} className="text-xs whitespace-nowrap">{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="w-full sm:w-[240px] text-sm md:text-xs data-[size=default]:h-11 md:data-[size=default]:h-8"
          >
            <SelectValue placeholder="Choose a volunteer…" />
          </SelectTrigger>
          <SelectContent>
            {volunteers.map((v) => (
              <SelectItem key={v.id} value={v.id} className="min-h-11 md:min-h-0">{v.firstName} {v.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
