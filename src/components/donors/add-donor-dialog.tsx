"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export function AddDonorDialog({ open, onOpenChange, campaignId }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string | null;
}) {
  const id = useId();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { saving, run } = useSavingAction();
  const empty = {
    firstName: "", lastName: "", email: "", phone: "", address: "", city: "", state: "", zip: "",
    employer: "", occupation: "", notes: "",
  };
  const [f, setF] = useState(empty);
  const [type, setType] = useState("individual");
  const [capacity, setCapacity] = useState("unknown");
  const [isRecurring, setIsRecurring] = useState(false);

  const field = (key: keyof typeof empty, label: string, props?: React.ComponentProps<typeof Input>) => (
    <div>
      <Label htmlFor={`${id}-${key}`} className="text-xs">{label}</Label>
      <Input
        id={`${id}-${key}`}
        value={f[key]}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        className="mt-1"
        autoComplete="off"
        {...props}
      />
    </div>
  );

  async function save() {
    if (!f.firstName.trim() || !f.lastName.trim()) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    await run(
      () => fetch("/api/donors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, ...f, type, capacity, isRecurring }),
      }),
      {
        failTitle: "Couldn't add the donor. Check the fields and try again.",
        onSuccess: () => {
          toast({ title: `Added ${f.firstName} ${f.lastName}`, duration: 1500 });
          qc.invalidateQueries({ queryKey: ["donors"] });
          qc.invalidateQueries({ queryKey: ["dashboard", campaignId] });
          setF(empty); setType("individual"); setCapacity("unknown"); setIsRecurring(false);
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a donor</DialogTitle>
          <DialogDescription>Only campaign owners can see donors. Record their gifts after adding them.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            {field("firstName", "First name")}
            {field("lastName", "Last name")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("email", "Email", { type: "email" })}
            {field("phone", "Phone", { type: "tel" })}
          </div>
          {field("address", "Street address")}
          <div className="grid grid-cols-3 gap-3">
            {field("city", "City")}
            {field("state", "State")}
            {field("zip", "ZIP", { inputMode: "numeric" })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("employer", "Employer")}
            {field("occupation", "Occupation")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`${id}-type`} className="text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id={`${id}-type`} className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="family">Family</SelectItem>
                  <SelectItem value="small-business">Small Business</SelectItem>
                  <SelectItem value="pac">PAC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${id}-capacity`} className="text-xs">Giving capacity</Label>
              <Select value={capacity} onValueChange={setCapacity}>
                <SelectTrigger id={`${id}-capacity`} className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="mid">Mid</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={`${id}-recurring`} checked={isRecurring} onCheckedChange={setIsRecurring} />
            <Label htmlFor={`${id}-recurring`} className="text-sm font-normal">Gives on a recurring schedule</Label>
          </div>
          <div>
            <Label htmlFor={`${id}-notes`} className="text-xs">Notes</Label>
            <Textarea id={`${id}-notes`} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="mt-1 min-h-[60px]" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Add donor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
