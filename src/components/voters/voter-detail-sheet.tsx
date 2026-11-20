"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Phone, Mail, MapPin, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NameField, inputClass } from "@/components/voters/add-voter-dialog";
import { useSavingAction } from "@/lib/use-saving-action";

interface VoterRow extends Voter {
  precinct?: { name: string; code: string } | null;
  household?: { address: string } | null;
  _count?: { callLogs: number; canvassLogs: number; donations?: number };
}

const sectionLabel = "text-[11px] uppercase tracking-wider text-muted-foreground";

/** Resolves to the API response; the sheet shows the error of a failed one. */
export type SaveResult = Promise<Response>;

const SAVE_FAILED = "Couldn't save that change. Check your connection and try again.";

/** The error the API sent with a failed response, or `fallback` when it sent none. */
async function errorFrom(r: Response, fallback: string): Promise<string> {
  const body = await r.json().catch(() => null);
  return body?.error ?? fallback;
}

export function VoterDetailSheet({
  voter,
  onClose,
  onUpdate,
  onDelete,
}: {
  voter: VoterRow | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Voter>) => SaveResult;
  /** Owners only; members get no Delete action. */
  onDelete?: (voter: Voter) => SaveResult;
}) {
  return (
    <Sheet open={!!voter} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {voter && (
          <VoterDetailForm key={voter.id} voter={voter} onUpdate={onUpdate} onDelete={onDelete} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function VoterDetailForm({
  voter,
  onUpdate,
  onDelete,
}: {
  voter: VoterRow;
  onUpdate: (id: string, patch: Partial<Voter>) => SaveResult;
  onDelete?: (voter: Voter) => SaveResult;
}) {
  const id = useId();
  const [notes, setNotes] = useState(voter.notes ?? "");
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const hasHistory = (voter._count?.callLogs ?? 0) + (voter._count?.canvassLogs ?? 0) > 0;

  async function update(patch: Partial<Voter>) {
    const r = await onUpdate(voter.id, patch);
    if (!r.ok) toast.error(await errorFrom(r, SAVE_FAILED));
  }

  function closeEditor() {
    // Render the Edit button again before focusing it.
    flushSync(() => setEditing(false));
    editRef.current?.focus();
  }

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
        {editing ? (
          <ContactEditor voter={voter} onSave={(patch) => onUpdate(voter.id, patch)} onClose={closeEditor} />
        ) : (
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <div className={sectionLabel}>Contact</div>
              <Button ref={editRef} variant="ghost" size="sm" className="h-11 sm:h-8" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                Edit
              </Button>
            </div>
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
            {!voter.phone && !voter.email && !address && (
              <p className="text-muted-foreground">No phone, email or address on file.</p>
            )}
          </div>
        )}

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
                  onClick={() => !current && update({ supportLevel: s.value })}
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
              onCheckedChange={(v) => update({ volunteer: v })}
            />
          </Label>
          <Label htmlFor={`${id}-yard-sign`} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md px-2 text-sm font-normal hover:bg-accent">
            Yard sign placed
            <Switch
              id={`${id}-yard-sign`}
              checked={voter.hasYardSign ?? false}
              onCheckedChange={(v) => update({ hasYardSign: v })}
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
            onBlur={() => notes !== (voter.notes ?? "") && update({ notes })}
            placeholder="Issues raised, follow-up reminders, etc."
            className="mt-1.5 min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground mt-1">Saved when you leave the box.</p>
        </div>

        {/* History */}
        {hasHistory && (
          <div>
            <div className={sectionLabel}>Outreach history</div>
            <dl className="mt-1.5 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <dt>Calls</dt>
                <dd className="tabular-nums">{voter._count?.callLogs ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Door visits</dt>
                <dd className="tabular-nums">{voter._count?.canvassLogs ?? 0}</dd>
              </div>
            </dl>
          </div>
        )}

        {onDelete && (
          <div className="border-t pt-4">
            {hasHistory ? (
              <p className="text-xs text-muted-foreground">
                Voters with contact attempts can't be deleted, so your outreach counts stay accurate. Correct their details instead.
              </p>
            ) : (
              <DeleteVoter voter={voter} onDelete={onDelete} />
            )}
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

function ContactEditor({
  voter,
  onSave,
  onClose,
}: {
  voter: Voter;
  onSave: (patch: Partial<Voter>) => SaveResult;
  onClose: () => void;
}) {
  const id = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(voter.firstName);
  const [lastName, setLastName] = useState(voter.lastName);
  const [phone, setPhone] = useState(voter.phone ?? "");
  const [email, setEmail] = useState(voter.email ?? "");
  const [address, setAddress] = useState(voter.registeredAddress ?? "");
  const [errors, setErrors] = useState<{ first?: string; last?: string; form?: string }>({});
  const { saving, run } = useSavingAction();

  // The Edit button that had focus is gone; start the keyboard at the first field.
  useEffect(() => firstRef.current?.focus(), []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const missing = {
      first: firstName.trim() ? undefined : "Enter a first name.",
      last: lastName.trim() ? undefined : "Enter a last name.",
    };
    setErrors(missing);
    if (missing.first || missing.last) {
      (missing.first ? firstRef : lastRef).current?.focus();
      return;
    }
    await run(() => onSave({ firstName, lastName, phone, email, registeredAddress: address }), {
      onSuccess: onClose,
      onError: async (r) => setErrors({ form: await errorFrom(r, SAVE_FAILED) }),
    });
  }

  return (
    <form onSubmit={save} noValidate className="space-y-3" aria-label="Edit contact details">
      {errors.form && <p role="alert" className="text-sm text-destructive">{errors.form}</p>}
      <div className="grid grid-cols-2 gap-3">
        <NameField id={`${id}-first`} label="First name" value={firstName} onChange={setFirstName} error={errors.first} inputRef={firstRef} />
        <NameField id={`${id}-last`} label="Last name" value={lastName} onChange={setLastName} error={errors.last} inputRef={lastRef} />
      </div>
      <div>
        <Label htmlFor={`${id}-phone`} className="text-xs">Phone</Label>
        <Input id={`${id}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} autoComplete="off" />
      </div>
      <div>
        <Label htmlFor={`${id}-email`} className="text-xs">Email</Label>
        <Input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="off" />
      </div>
      <div>
        <Label htmlFor={`${id}-address`} className="text-xs">Street address</Label>
        <Input id={`${id}-address`} value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="123 Main St" autoComplete="off" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="h-11 sm:h-9" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin mr-1" aria-hidden /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}

function DeleteVoter({ voter, onDelete }: { voter: Voter; onDelete: (voter: Voter) => SaveResult }) {
  const [error, setError] = useState<string | null>(null);
  const { saving: deleting, run } = useSavingAction();
  const name = `${voter.firstName} ${voter.lastName}`;

  async function confirm() {
    // On success the sheet closes and this unmounts.
    await run(() => onDelete(voter), {
      onError: async (r) => setError(await errorFrom(r, "Couldn't delete this voter. Check your connection and try again.")),
    });
  }

  return (
    <AlertDialog onOpenChange={() => setError(null)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="h-11 sm:h-9 text-destructive hover:text-destructive">
          <Trash2 aria-hidden />
          Delete voter
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {name} will be removed from your voter list for everyone on the campaign. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 sm:h-9">Cancel</AlertDialogCancel>
          <Button variant="destructive" className="h-11 sm:h-9" onClick={confirm} disabled={deleting}>
            {deleting ? <Loader2 className="size-4 animate-spin mr-1" aria-hidden /> : null}
            Delete {name}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
