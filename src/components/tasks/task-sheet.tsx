"use client";

import { useState } from "react";
import { Loader2, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useSavingAction } from "@/lib/use-saving-action";
import { formatDate } from "@/lib/format";
import type { Task, Volunteer } from "@/lib/types";
import { TASK_STATUS, TASK_STATUSES, TaskFields, draftBody, draftFrom, selectClass, type TaskDraft } from "./task-fields";

/** Edit everything about one task; owners can also delete it. */
export function TaskSheet({ task, volunteers, canDelete, onClose, onSaved, onDeleted }: {
  task: Task | null;
  volunteers: Volunteer[];
  canDelete: boolean;
  onClose: () => void;
  onSaved: (title: string) => void;
  onDeleted: (title: string) => void;
}) {
  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {/* Keyed so the form resets when a different task opens. */}
        {task && <TaskEditor key={task.id} task={task} volunteers={volunteers} canDelete={canDelete} onSaved={onSaved} onDeleted={onDeleted} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskEditor({ task, volunteers, canDelete, onSaved, onDeleted }: {
  task: Task;
  volunteers: Volunteer[];
  canDelete: boolean;
  onSaved: (title: string) => void;
  onDeleted: (title: string) => void;
}) {
  const { saving, run } = useSavingAction();
  const [draft, setDraft] = useState<TaskDraft>(() => draftFrom(task));
  const [status, setStatus] = useState(task.status);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = draftBody(draft);
    if (!body.title) return;
    await run(
      () =>
        fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id, status, ...body }),
        }),
      { failTitle: "Couldn't save the task", onSuccess: () => onSaved(body.title) }
    );
  }

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>Edit task</SheetTitle>
        <SheetDescription>Added {formatDate(task.createdAt)}</SheetDescription>
      </SheetHeader>
      <form onSubmit={save} className="space-y-4 px-4 pb-6">
        {task.voter && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="size-4" aria-hidden /> About {task.voter.firstName} {task.voter.lastName}
          </p>
        )}
        <div>
          <Label htmlFor="edit-task-status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="edit-task-status" className={`mt-1 ${selectClass}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{TASK_STATUS[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TaskFields id="edit-task" draft={draft} onChange={setDraft} volunteers={volunteers} />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {canDelete ? <DeleteTask task={task} onDeleted={onDeleted} /> : <span />}
          <Button type="submit" className="h-11 md:h-9" disabled={saving || !draft.title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save changes
          </Button>
        </div>
      </form>
    </>
  );
}

function DeleteTask({ task, onDeleted }: { task: Task; onDeleted: (title: string) => void }) {
  const { saving, run } = useSavingAction();
  async function confirm() {
    await run(
      () =>
        fetch("/api/tasks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id }),
        }),
      { failTitle: "Couldn't delete the task", onSuccess: () => onDeleted(task.title) }
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11 md:h-9 text-destructive hover:text-destructive">
          <Trash2 aria-hidden /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{task.title}&rdquo; will be removed for everyone on the campaign. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 sm:h-9">Cancel</AlertDialogCancel>
          <Button variant="destructive" className="h-11 sm:h-9" onClick={confirm} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Delete task
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
