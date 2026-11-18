"use client";

import { useId, useState } from "react";
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
import { SUPPORT_LEVELS } from "@/lib/types";

const NONE = "none";
const PARTIES = ["Dem", "Rep", "Ind", "Green", "Lib", "NPP"];

export function AddVoterDialog({ open, onOpenChange, campaignId, precincts }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string | null;
  precincts: { id: string; name: string }[];
}) {
  const id = useId();
  const qc = useQueryClient();
  
  const { saving, run } = useSavingAction();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [party, setParty] = useState(NONE);
  const [supportLevel, setSupportLevel] = useState("unknown");
  const [precinctId, setPrecinctId] = useState(NONE);
  const [notes, setNotes] = useState("");

  function reset() {
    setFirstName(""); setLastName(""); setPhone(""); setEmail(""); setAddress("");
    setParty(NONE); setSupportLevel("unknown"); setPrecinctId(NONE); setNotes("");
  }

  async function save() {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required");
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
        failTitle: "Couldn't add the voter. Check the fields and try again.",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a voter</DialogTitle>
          <DialogDescription>Add one person to your voter list. Only the name is required.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`${id}-first`} className="text-xs">First name</Label>
              <Input id={`${id}-first`} value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor={`${id}-last`} className="text-xs">Last name</Label>
              <Input id={`${id}-last`} value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" autoComplete="off" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`${id}-phone`} className="text-xs">Phone</Label>
              <Input id={`${id}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor={`${id}-email`} className="text-xs">Email</Label>
              <Input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" autoComplete="off" />
            </div>
          </div>
          <div>
            <Label htmlFor={`${id}-address`} className="text-xs">Street address</Label>
            <Input id={`${id}-address`} value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1" placeholder="123 Main St" autoComplete="off" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor={`${id}-party`} className="text-xs">Party</Label>
              <Select value={party} onValueChange={setParty}>
                <SelectTrigger id={`${id}-party`} className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not recorded</SelectItem>
                  {PARTIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${id}-support`} className="text-xs">Support</Label>
              <Select value={supportLevel} onValueChange={setSupportLevel}>
                <SelectTrigger id={`${id}-support`} className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPORT_LEVELS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${id}-precinct`} className="text-xs">Precinct</Label>
              <Select value={precinctId} onValueChange={setPrecinctId}>
                <SelectTrigger id={`${id}-precinct`} className="mt-1 w-full"><SelectValue /></SelectTrigger>
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Add voter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
