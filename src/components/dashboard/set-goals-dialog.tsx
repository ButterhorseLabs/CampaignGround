"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSavingAction } from "@/lib/use-saving-action";

/** Owner-only: the vote and fundraising goals the dashboard measures against. Blank means no goal. */
export function SetGoalsDialog({ open, onOpenChange, campaignId, voteGoal, fundraisingGoalCents }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string;
  voteGoal: number;
  fundraisingGoalCents: number;
}) {
  const qc = useQueryClient();
  const { saving, run } = useSavingAction();
  const [votes, setVotes] = useState(voteGoal ? String(voteGoal) : "");
  const [dollars, setDollars] = useState(fundraisingGoalCents ? String(fundraisingGoalCents / 100) : "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await run(
      () =>
        fetch("/api/campaign", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId,
            voteGoal: votes ? Number(votes) : 0,
            fundraisingGoalCents: dollars ? Math.round(Number(dollars) * 100) : 0,
          }),
        }),
      {
        failTitle: "Couldn't save goals",
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["dashboard", campaignId] });
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Campaign goals</DialogTitle>
            <DialogDescription>The dashboard tracks progress and daily pace against these. Leave a goal blank if you don't have one.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="goal-votes">Supporters needed to win</Label>
            <Input id="goal-votes" type="number" inputMode="numeric" min={0} step={1} value={votes} onChange={(e) => setVotes(e.target.value)} className="mt-1 h-11 md:h-9" />
          </div>
          <div>
            <Label htmlFor="goal-dollars">Fundraising goal (USD)</Label>
            <Input id="goal-dollars" type="number" inputMode="decimal" min={0} step={1} value={dollars} onChange={(e) => setDollars(e.target.value)} className="mt-1 h-11 md:h-9" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="h-11 md:h-9" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-1" aria-hidden />}
              Save goals
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
