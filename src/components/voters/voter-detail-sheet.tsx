"use client";

import { useId, useState } from "react";
import { Phone, Mail, MapPin } from "lucide-react";
import { PersonAvatar } from "@/components/common/person-avatar";
import { PartyBadge, supportTone } from "@/components/common/badges";
import { SUPPORT_LEVELS, SUPPORT_SOURCE_LABELS, type Voter } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface VoterRow extends Voter {
  precinct?: { name: string; code: string } | null;
  household?: { address: string } | null;
  _count?: { callLogs: number; canvassLogs: number; donations?: number };
}

const sectionLabel = "text-[11px] uppercase tracking-wider text-muted-foreground";

export function VoterDetailSheet({
  voter,
  onClose,
  onUpdate,
}: {
  voter: VoterRow | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Voter>) => void;
}) {
  return (
    <Sheet open={!!voter} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {voter && (
          <VoterDetailForm key={voter.id} voter={voter} onUpdate={onUpdate} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function VoterDetailForm({
  voter,
  onUpdate,
}: {
  voter: VoterRow;
  onUpdate: (id: string, patch: Partial<Voter>) => void;
}) {
  const id = useId();
  const [notes, setNotes] = useState(voter.notes ?? "");
  const address = voter.household?.address ?? voter.registeredAddress;
  const voted = [voter.votedIn2024 && "2024", voter.votedIn2022 && "2022", voter.votedIn2020 && "2020"].filter(Boolean);

  return (
    <>
      <SheetHeader className="pb-3 border-b">
        <div className="flex items-center gap-3 pr-10">
          <span aria-hidden><PersonAvatar first={voter.firstName} last={voter.lastName} size="lg" /></span>
          <div className="min-w-0">
            <SheetTitle>{voter.firstName} {voter.lastName}</SheetTitle>
            <SheetDescription className="text-xs">
              {voter.precinct?.name ?? "No precinct assigned"}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="p-4 space-y-5">
        {/* Contact info */}
        <div className="space-y-1 text-sm">
          {voter.phone && (
            <a
              href={`tel:${voter.phone}`}
              className="-mx-2 flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-accent sm:min-h-9"
            >
              <Phone className="size-4 text-muted-foreground" aria-hidden />
              <span className="tabular-nums">{voter.phone}</span>
            </a>
          )}
          {voter.email && (
            <a
              href={`mailto:${voter.email}`}
              className="-mx-2 flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-accent sm:min-h-9"
            >
              <Mail className="size-4 text-muted-foreground" aria-hidden />
              <span className="truncate">{voter.email}</span>
            </a>
          )}
          {address && (
            <div className="flex items-start gap-2 py-2">
              <MapPin className="size-4 text-muted-foreground mt-0.5" aria-hidden />
              <span>{address}</span>
            </div>
          )}
        </div>

        {/* Quick facts */}
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <Fact label="Party" value={voter.partyAffiliation ? <PartyBadge party={voter.partyAffiliation} /> : "Not recorded"} />
          <Fact label="Voter since" value={voter.voterSince ?? "—"} />
          <Fact label="Birth year" value={voter.birthYear ?? "—"} />
          <Fact label="Voted in" value={voted.length ? voted.join(", ") : "No recent elections on file"} />
        </dl>

        {/* Support level */}
        <div role="group" aria-labelledby={`${id}-support`}>
          <div id={`${id}-support`} className={sectionLabel}>Support level</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {SUPPORT_LEVELS.map((s) => {
              const current = voter.supportLevel === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={current}
                  onClick={() => !current && onUpdate(voter.id, { supportLevel: s.value })}
                  className={cn(
                    "h-11 sm:h-8 px-3 rounded-full text-xs border transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    current ? cn(supportTone(s.value), "font-semibold") : "bg-card hover:bg-accent"
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {voter.supportLevelSource && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Last changed from a {SUPPORT_SOURCE_LABELS[voter.supportLevelSource] ?? voter.supportLevelSource}.
            </p>
          )}
        </div>

        {/* Toggles: the whole row is the label, so it is the touch target. */}
        <div className="-mx-2">
          <Label htmlFor={`${id}-volunteer`} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-sm font-normal hover:bg-accent">
            Recruited as volunteer
            <Switch
              id={`${id}-volunteer`}
              checked={voter.volunteer ?? false}
              onCheckedChange={(v) => onUpdate(voter.id, { volunteer: v })}
            />
          </Label>
          <Label htmlFor={`${id}-yard-sign`} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-sm font-normal hover:bg-accent">
            Yard sign placed
            <Switch
              id={`${id}-yard-sign`}
              checked={voter.hasYardSign ?? false}
              onCheckedChange={(v) => onUpdate(voter.id, { hasYardSign: v })}
            />
          </Label>
        </div>

        {/* Notes */}
        <div>
          <Label htmlFor={`${id}-notes`} className={sectionLabel}>Field notes</Label>
          <Textarea
            id={`${id}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (voter.notes ?? "") && onUpdate(voter.id, { notes })}
            placeholder="Issues raised, follow-up reminders, etc."
            className="mt-1.5 min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground mt-1">Saved when you leave the box.</p>
        </div>

        {/* History */}
        {((voter._count?.callLogs ?? 0) + (voter._count?.canvassLogs ?? 0) > 0) && (
          <div>
            <div className={sectionLabel}>Outreach history</div>
            <dl className="mt-1.5 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <dt>Calls</dt>
                <dd className="tabular-nums">{voter._count?.callLogs ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Door knocks</dt>
                <dd className="tabular-nums">{voter._count?.canvassLogs ?? 0}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-2">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
