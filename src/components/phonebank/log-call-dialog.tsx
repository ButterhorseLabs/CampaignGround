"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ISSUES, SUPPORT_LEVELS } from "@/lib/types";

/** Call outcomes in button order (and keyboard 1–6), with their status-ramp hue (DESIGN.md: Status and Data Colors). */
export const OUTCOME_INFO: Record<string, { label: string; color: string }> = {
  contacted: { label: "Talked to them", color: "emerald" },
  "no-answer": { label: "No answer", color: "slate" },
  voicemail: { label: "Left voicemail", color: "amber" },
  "call-back": { label: "Call back later", color: "violet" },
  refused: { label: "Refused", color: "red" },
  "wrong-number": { label: "Wrong number", color: "red" },
};

export interface ContactedDetails {
  supportLevel?: string;
  issuePriority?: string;
  notes: string;
}

// Radio cards: the native input stays focusable and announces as a radio; the label is the 44px target.
const choiceClass =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-medium has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50";

/** The follow-up after a conversation: what the voter said. Every field is optional. */
export function ContactedCallDialog({ open, onOpenChange, voterName, callerName, saving, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  voterName: string;
  callerName: string;
  saving: boolean;
  onSave: (details: ContactedDetails) => void;
}) {
  const id = useId();
  const [support, setSupport] = useState("");
  const [issue, setIssue] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Talked to {voterName}</DialogTitle>
          <DialogDescription>Logging as {callerName}. Fill in what you heard; anything left blank is fine.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset>
            <legend className="text-xs font-medium mb-1.5">Support level</legend>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: "", label: "Didn't say" }, ...SUPPORT_LEVELS.filter((s) => s.value !== "unknown")].map((s) => (
                <label key={s.value || "none"} className={choiceClass}>
                  <input
                    type="radio"
                    name={`${id}-support`}
                    value={s.value}
                    checked={support === s.value}
                    onChange={() => setSupport(s.value)}
                    className="size-4 accent-primary"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
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
          <div>
            <Label htmlFor={`${id}-notes`} className="text-xs">Notes</Label>
            <Textarea
              id={`${id}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 min-h-[60px]"
              placeholder="What they said, a good time to call back…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11 sm:h-9" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="h-11 sm:h-9"
            disabled={saving}
            onClick={() => onSave({ supportLevel: support || undefined, issuePriority: issue || undefined, notes })}
          >
            {saving && <Loader2 className="size-4 animate-spin mr-1" aria-hidden />}
            Save call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
