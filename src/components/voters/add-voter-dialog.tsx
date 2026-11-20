"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useSavingAction } from "@/lib/use-saving-action";
import { PARTIES, SUPPORT_LEVELS } from "@/lib/types";

const NONE = "none";
export const inputClass = "mt-1 h-11 sm:h-9";
// SelectTrigger sets its height through data-size, so override that selector.
const selectField = "mt-1 w-full data-[size=default]:h-11 sm:data-[size=default]:h-9";

// Module-level so the ref callback keeps one identity and runs only when the error first appears.
const revealOnMount = (el: HTMLElement | null) => el?.scrollIntoView({ block: "nearest" });

interface Errors {
  first?: string;
  last?: string;
  /** Returned by the server, e.g. a duplicate voter. */
  form?: string;
}

export function AddVoterDialog({ open, onOpenChange, campaignId, precincts }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string | null;
  precincts: { id: string; name: string }[];
}) {
  const id = useId();
  const qc = useQueryClient();
  const { saving, run } = useSavingAction();
  const firstRef = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [party, setParty] = useState(NONE);
  const [supportLevel, setSupportLevel] = useState("unknown");
  const [precinctId, setPrecinctId] = useState(NONE);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function reset() {
    setFirstName(""); setLastName(""); setPhone(""); setEmail(""); setAddress("");
    setParty(NONE); setSupportLevel("unknown"); setPrecinctId(NONE); setNotes("");
    setErrors({});
  }

  function handleOpenChange(o: boolean) {
    if (!o) setErrors({});
    onOpenChange(o);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const missing: Errors = {
      first: firstName.trim() ? undefined : "Enter a first name.",
      last: lastName.trim() ? undefined : "Enter a last name.",
    };
    setErrors(missing);
    if (missing.first || missing.last) {
      (missing.first ? firstRef : lastRef).current?.focus();
      return;
    }
    await run(
      () => fetch("/api/voters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          firstName,
          lastName,
          phone,
          email,
          registeredAddress: address,
          partyAffiliation: party === NONE ? null : party,
          supportLevel,
          precinctId: precinctId === NONE ? null : precinctId,
          notes,
        }),
      }),
      {
        onError: async (r) => {
          const body = await r.json().catch(() => null);
          setErrors({ form: body?.error ?? "Couldn't add the voter. Check the fields and try again." });
        },
        onSuccess: () => {
          toast(`Added ${firstName} ${lastName}`, { duration: 1500 });
          qc.invalidateQueries({ queryKey: ["voters", campaignId] });
          qc.invalidateQueries({ queryKey: ["dashboard", campaignId] });
          reset();
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={save} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>Add a voter</DialogTitle>
            <DialogDescription>Add one person to your voter list. Only the name is required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {errors.form && (
              <p role="alert" ref={revealOnMount} className="text-sm text-destructive">
                {errors.form}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <NameField
                id={`${id}-first`}
                label="First name"
                value={firstName}
                onChange={setFirstName}
                error={errors.first}
                inputRef={firstRef}
              />
              <NameField
                id={`${id}-last`}
                label="Last name"
                value={lastName}
                onChange={setLastName}
                error={errors.last}
                inputRef={lastRef}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`${id}-phone`} className="text-xs">Phone</Label>
                <Input id={`${id}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} autoComplete="off" />
              </div>
              <div>
                <Label htmlFor={`${id}-email`} className="text-xs">Email</Label>
                <Input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="off" />
              </div>
            </div>
            <div>
              <Label htmlFor={`${id}-address`} className="text-xs">Street address</Label>
              <Input id={`${id}-address`} value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} placeholder="123 Main St" autoComplete="off" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor={`${id}-party`} className="text-xs">Party</Label>
                <Select value={party} onValueChange={setParty}>
                  <SelectTrigger id={`${id}-party`} className={selectField}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not recorded</SelectItem>
                    {PARTIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`${id}-support`} className="text-xs">Support</Label>
                <Select value={supportLevel} onValueChange={setSupportLevel}>
                  <SelectTrigger id={`${id}-support`} className={selectField}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORT_LEVELS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={`${id}-precinct`} className="text-xs">Precinct</Label>
                <Select value={precinctId} onValueChange={setPrecinctId}>
                  <SelectTrigger id={`${id}-precinct`} className={selectField}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {precincts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor={`${id}-notes`} className="text-xs">Notes</Label>
              <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="h-11 sm:h-9" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-1" aria-hidden /> : null}
              Add voter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NameField({ id, label, value, onChange, error, inputRef }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  inputRef: React.Ref<HTMLInputElement>;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label} <span className="font-normal text-muted-foreground">(required)</span>
      </Label>
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        autoComplete="off"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <p id={`${id}-error`} className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
