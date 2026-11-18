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
import { useToast } from "@/hooks/use-toast";
import { useSavingAction } from "@/lib/use-saving-action";

const ROLES: { value: string; label: string }[] = [
  { value: "general", label: "General" },
  { value: "canvasser", label: "Canvasser" },
  { value: "phone-banker", label: "Phone Banker" },
  { value: "coordinator", label: "Coordinator" },
  { value: "designer", label: "Designer" },
  { value: "data", label: "Data" },
];

export function AddVolunteerDialog({ open, onOpenChange, campaignId }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string | null;
}) {
  const id = useId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { saving, run } = useSavingAction();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("general");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");

  async function save() {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    await run(
      () => fetch("/api/volunteers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, firstName, lastName, email, phone, role, zip, notes }),
      }),
      {
        failTitle: "Couldn't add the volunteer. Check the fields and try again.",
        onSuccess: () => {
          toast({ title: `Added ${firstName} ${lastName}`, duration: 1500 });
          qc.invalidateQueries({ queryKey: ["volunteers", campaignId] });
          qc.invalidateQueries({ queryKey: ["dashboard", campaignId] });
          setFirstName(""); setLastName(""); setEmail(""); setPhone("");
          setRole("general"); setZip(""); setNotes("");
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a volunteer</DialogTitle>
          <DialogDescription>
            Add someone helping the campaign. To give them a login, invite them from the top bar instead.
          </DialogDescription>
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
              <Label htmlFor={`${id}-email`} className="text-xs">Email</Label>
              <Input id={`${id}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" autoComplete="off" />
            </div>
            <div>
              <Label htmlFor={`${id}-phone`} className="text-xs">Phone</Label>
              <Input id={`${id}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" autoComplete="off" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`${id}-role`} className="text-xs">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id={`${id}-role`} className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${id}-zip`} className="text-xs">ZIP</Label>
              <Input id={`${id}-zip`} value={zip} onChange={(e) => setZip(e.target.value)} className="mt-1" inputMode="numeric" autoComplete="off" />
            </div>
          </div>
          <div>
            <Label htmlFor={`${id}-notes`} className="text-xs">Notes</Label>
            <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-[60px]" placeholder="Availability, skills, how they found the campaign" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Add volunteer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
