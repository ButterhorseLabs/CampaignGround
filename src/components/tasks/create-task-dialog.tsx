"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSavingAction } from "@/lib/use-saving-action";
import type { Volunteer } from "@/lib/types";
import { TaskFields, draftBody, emptyDraft, type TaskDraft } from "./task-fields";

export function CreateTaskDialog({ open, onOpenChange, volunteers, campaignId, defaultAssigneeId, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  volunteers: Volunteer[];
  campaignId: string | null;
  /** Prefills the assignee, e.g. the member's own volunteer record. */
  defaultAssigneeId?: string;
  onSaved: (title: string) => void;
}) {
  const { saving, run } = useSavingAction();
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);

  function openChange(o: boolean) {
    if (o) setDraft({ ...emptyDraft, assignedVolunteerId: defaultAssigneeId ?? "" });
    onOpenChange(o);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = draftBody(draft);
    if (!body.title) return;
    await run(
      () =>
        fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, campaignId }),
        }),
      { failTitle: "Couldn't create the task", onSuccess: () => onSaved(body.title) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        <Button className="h-11 md:h-9">
          <Plus className="size-4" aria-hidden /> New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Give it a clear title, a due date, and someone to own it.</DialogDescription>
          </DialogHeader>
          <TaskFields id="new-task" draft={draft} onChange={setDraft} volunteers={volunteers} />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => openChange(false)}>Cancel</Button>
            <Button type="submit" className="h-11 md:h-9" disabled={saving || !draft.title.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
