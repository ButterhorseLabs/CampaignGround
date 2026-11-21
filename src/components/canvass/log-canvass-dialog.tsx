"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ISSUES, SUPPORT_LEVELS, type CanvassLog, type Voter, type Volunteer } from "@/lib/types";
import { useSavingAction } from "@/lib/use-saving-action";
import { useVoters } from "@/lib/voters";
import { cn } from "@/lib/utils";

// Only what the dialog reads, so walk-list doors and full voter rows both fit.
type LogVoter = Pick<Voter, "id" | "firstName" | "lastName" | "householdId" | "campaignId"> & {
  household?: { address: string } | null;
};

/** Canvass outcomes, with their status-ramp hue (DESIGN.md: Status and Data Colors). */
export const OUTCOME_INFO: Record<string, { label: string; color: string }> = {
  "not-home": { label: "Not home", color: "amber" },
  contacted: { label: "Contacted", color: "emerald" },
  refused: { label: "Refused", color: "red" },
  "wrong-address": { label: "Wrong address", color: "slate" },
  "language-barrier": { label: "Language barrier", color: "violet" },
};

// Radio cards: the native input stays focusable and announces as a radio; the label is the 44px target.
const choiceClass =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-medium has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50";

export function LogCanvassDialog({ open, onOpenChange, campaignId, doorVoters, defaultVoterId, volunteer, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string | null;
  /** The voters at a claimed door. Without them the dialog searches the whole voter list. */
  doorVoters?: LogVoter[];
  defaultVoterId?: string;
  volunteer: Volunteer;
  onSaved: (log: CanvassLog) => void;
}) {
  const id = useId();
  const { saving, run } = useSavingAction();
  const [voter, setVoter] = useState<LogVoter | null>(doorVoters?.find((v) => v.id === defaultVoterId) ?? null);
  const [outcome, setOutcome] = useState("");
  const [support, setSupport] = useState("");
  const [yardSign, setYardSign] = useState(false);
  const [issue, setIssue] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ voter?: string; outcome?: string }>({});

  async function save() {
    const missing = {
      voter: voter ? undefined : "Choose who you talked to, or whose door it was.",
      outcome: outcome ? undefined : "Choose what happened at the door.",
    };
    setErrors(missing);
    if (!voter || !outcome) return;
    let res: Response | undefined;
    await run(
      async () =>
        (res = await fetch("/api/canvass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voterId: voter.id,
            householdId: voter.householdId ?? undefined,
            volunteerId: volunteer.id,
            campaignId: voter.campaignId,
            outcome,
            supportLevel: outcome === "contacted" ? support || undefined : undefined,
            yardSign: outcome === "contacted" && yardSign,
            issuePriority: outcome === "contacted" ? issue || undefined : undefined,
            notes,
          }),
        })),
      {
        onError: async (r) => {
          const body = await r.json().catch(() => null);
          toast.error("Couldn't save this visit", { description: body?.error ?? "Try again in a moment." });
        },
        onSuccess: async () => onSaved(await res!.json()),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a visit</DialogTitle>
          <DialogDescription>
            Logging as {volunteer.firstName} {volunteer.lastName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {doorVoters ? (
            <DoorVoterChoice id={id} voters={doorVoters} value={voter} onChange={setVoter} error={errors.voter} />
          ) : (
            <VoterSearch id={id} campaignId={campaignId} value={voter} onChange={setVoter} error={errors.voter} />
          )}

          <fieldset aria-describedby={errors.outcome ? `${id}-outcome-error` : undefined}>
            <legend className="text-xs font-medium mb-1.5">What happened?</legend>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(OUTCOME_INFO).map(([value, info]) => (
                <label key={value} className={cn(choiceClass, value === "not-home" && "col-span-2")}>
                  <input
                    type="radio"
                    name={`${id}-outcome`}
                    value={value}
                    checked={outcome === value}
                    onChange={() => setOutcome(value)}
                    className="size-4 accent-primary"
                  />
                  {info.label}
                </label>
              ))}
            </div>
            {errors.outcome && !outcome && (
              <p id={`${id}-outcome-error`} role="alert" className="mt-1.5 text-xs font-medium text-destructive">{errors.outcome}</p>
            )}
          </fieldset>

          {outcome === "contacted" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`${id}-support`} className="text-xs">Support level</Label>
                  <Select value={support} onValueChange={setSupport}>
                    <SelectTrigger id={`${id}-support`} className="mt-1 w-full data-[size=default]:h-11 md:data-[size=default]:h-9">
                      <SelectValue placeholder="Not asked" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORT_LEVELS.map((s) => (
                        <SelectItem key={s.value} value={s.value} className="min-h-11 md:min-h-0">{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`${id}-issue`} className="text-xs">Top issue</Label>
                  <Select value={issue} onValueChange={setIssue}>
                    <SelectTrigger id={`${id}-issue`} className="mt-1 w-full data-[size=default]:h-11 md:data-[size=default]:h-9">
                      <SelectValue placeholder="None mentioned" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUES.map((i) => (
                        <SelectItem key={i.value} value={i.value} className="min-h-11 md:min-h-0">{i.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3">
                <Label htmlFor={`${id}-yard-sign`} className="flex-1 py-3 text-sm font-normal">Wants a yard sign</Label>
                <Switch id={`${id}-yard-sign`} checked={yardSign} onCheckedChange={setYardSign} />
              </div>
            </>
          )}

          <div>
            <Label htmlFor={`${id}-notes`} className="text-xs">Notes</Label>
            <Textarea
              id={`${id}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 min-h-[60px]"
              placeholder="What they said, follow-up needed…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11 sm:h-9" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="h-11 sm:h-9" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-1" aria-hidden /> : null}
            Save visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoterOption({ id, voter, checked, onChange, showAddress = true }: {
  id: string;
  voter: LogVoter;
  checked: boolean;
  onChange: () => void;
  showAddress?: boolean;
}) {
  return (
    <label className={choiceClass}>
      <input type="radio" name={`${id}-voter`} checked={checked} onChange={onChange} className="size-4 accent-primary" />
      <span className="min-w-0">
        <span className="block truncate">{voter.firstName} {voter.lastName}</span>
        {showAddress && voter.household?.address && <span className="block truncate text-xs font-normal text-muted-foreground">{voter.household.address}</span>}
      </span>
    </label>
  );
}

function VoterError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return <p id={`${id}-voter-error`} role="alert" className="mt-1.5 text-xs font-medium text-destructive">{error}</p>;
}

/** Housemates at a claimed door: pick who answered. */
function DoorVoterChoice({ id, voters, value, onChange, error }: {
  id: string;
  voters: LogVoter[];
  value: LogVoter | null;
  onChange: (v: LogVoter) => void;
  error?: string;
}) {
  return (
    <fieldset aria-describedby={error ? `${id}-voter-error` : undefined}>
      <legend className="text-xs font-medium mb-1.5">
        {voters[0]?.household?.address ? `At ${voters[0].household.address}` : "Voter"}
      </legend>
      <div className="grid gap-2">
        {voters.map((v) => (
          <VoterOption key={v.id} id={id} voter={v} checked={value?.id === v.id} onChange={() => onChange(v)} showAddress={false} />
        ))}
      </div>
      {!value && <VoterError id={id} error={error} />}
    </fieldset>
  );
}

/** Logging without a walk list: search every voter in the campaign on the server. */
function VoterSearch({ id, campaignId, value, onChange, error }: {
  id: string;
  campaignId: string | null;
  value: LogVoter | null;
  onChange: (v: LogVoter) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const { data, isFetching } = useVoters(campaignId, { q: debounced, limit: "8" }, { keepPrevious: true });
  // Keep the chosen voter listed even when a new search no longer matches them.
  const results = (data?.items ?? []).filter((v) => v.id !== value?.id);

  return (
    <fieldset aria-describedby={error ? `${id}-voter-error` : undefined}>
      <legend className="text-xs font-medium mb-1.5">Voter</legend>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Search voters by name or address"
          placeholder="Search by name or address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 pl-9 md:h-9"
        />
      </div>
      <div className="mt-2 grid gap-2" aria-busy={isFetching}>
        {value && <VoterOption id={id} voter={value} checked onChange={() => {}} />}
        {results.map((v) => (
          <VoterOption key={v.id} id={id} voter={v} checked={false} onChange={() => onChange(v)} />
        ))}
        {data && results.length === 0 && !value && (
          <p className="py-2 text-sm text-muted-foreground">No voters match “{debounced}”.</p>
        )}
      </div>
      {!value && <VoterError id={id} error={error} />}
    </fieldset>
  );
}
