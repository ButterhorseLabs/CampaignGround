"use client";

import { Circle, Clock, CheckCircle2, AlertCircle, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Task, Volunteer } from "@/lib/types";

/** One colour (status ramp) and one icon per status, everywhere tasks appear. */
export const TASK_STATUS: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  todo: { label: "To do", color: "slate", icon: Circle },
  "in-progress": { label: "In progress", color: "amber", icon: Clock },
  done: { label: "Done", color: "emerald", icon: CheckCircle2 },
  blocked: { label: "Blocked", color: "red", icon: AlertCircle },
};
export const TASK_STATUSES = ["todo", "in-progress", "done", "blocked"] as const;

export const TASK_PRIORITY: Record<string, string> = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };

export const selectClass = "w-full data-[size=default]:h-11 md:data-[size=default]:h-9";
const fieldClass = "mt-1 h-11 md:h-9";
const NONE = "none";

export interface TaskDraft {
  title: string;
  description: string;
  priority: string;
  /** YYYY-MM-DD, or "" for no due date. */
  dueDate: string;
  /** "" for unassigned. */
  assignedVolunteerId: string;
}

export const emptyDraft: TaskDraft = { title: "", description: "", priority: "medium", dueDate: "", assignedVolunteerId: "" };

export const draftFrom = (t: Task): TaskDraft => ({
  title: t.title,
  description: t.description ?? "",
  priority: t.priority,
  dueDate: t.dueDate?.slice(0, 10) ?? "",
  assignedVolunteerId: t.assignedVolunteerId ?? "",
});

/** The request body for a draft; due dates are calendar days stored at midnight UTC. */
export const draftBody = (d: TaskDraft) => ({
  title: d.title.trim(),
  description: d.description.trim() || null,
  priority: d.priority,
  dueDate: d.dueDate ? `${d.dueDate}T00:00:00.000Z` : null,
  assignedVolunteerId: d.assignedVolunteerId || null,
});

/** Title, details, priority, due date, and assignee: shared by the create dialog and the task sheet. */
export function TaskFields({ id, draft, onChange, volunteers }: {
  id: string;
  draft: TaskDraft;
  onChange: (d: TaskDraft) => void;
  volunteers: Volunteer[];
}) {
  const set = (patch: Partial<TaskDraft>) => onChange({ ...draft, ...patch });
  const sorted = [...volunteers].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input id={`${id}-title`} required value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Print walk-list packets" className={fieldClass} />
      </div>
      <div>
        <Label htmlFor={`${id}-description`}>Details</Label>
        <Textarea id={`${id}-description`} value={draft.description} onChange={(e) => set({ description: e.target.value })} className="mt-1 min-h-[72px]" placeholder="Where, who to call, what done looks like" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${id}-priority`}>Priority</Label>
          <Select value={draft.priority} onValueChange={(priority) => set({ priority })}>
            <SelectTrigger id={`${id}-priority`} className={`mt-1 ${selectClass}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TASK_PRIORITY).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-due`}>Due date</Label>
          <Input id={`${id}-due`} type="date" value={draft.dueDate} onChange={(e) => set({ dueDate: e.target.value })} className={fieldClass} />
        </div>
      </div>
      <div>
        <Label htmlFor={`${id}-assignee`}>Assigned to</Label>
        <Select value={draft.assignedVolunteerId || NONE} onValueChange={(v) => set({ assignedVolunteerId: v === NONE ? "" : v })}>
          <SelectTrigger id={`${id}-assignee`} className={`mt-1 ${selectClass}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Unassigned</SelectItem>
            {sorted.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.firstName} {v.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
