"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Check, ListTodo, CheckCircle2, AlertCircle, CalendarClock, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/common/stat-card";
import { StatusBadge } from "@/components/common/badges";
import { cn } from "@/lib/utils";
import { formatDate, isPastDue } from "@/lib/format";
import { useApp } from "@/lib/store";
import { useCurrentMembership } from "@/lib/memberships";
import { useVolunteers } from "@/lib/volunteers";
import type { Task, Volunteer } from "@/lib/types";
import { CreateTaskDialog } from "./create-task-dialog";
import { TaskSheet } from "./task-sheet";
import { TASK_PRIORITY, TASK_STATUS, TASK_STATUSES, selectClass } from "./task-fields";

type TasksData = { items: Task[]; truncated: boolean };

const ALL = "all";
const EMPTY_COLUMN: Record<string, string> = {
  todo: "Nothing waiting to start.",
  "in-progress": "Nothing underway.",
  done: "Nothing finished yet.",
  blocked: "Nothing blocked.",
};

const n = (v: number) => v.toLocaleString("en-US");
const dueLabel = (iso: string) => formatDate(iso, { year: undefined, timeZone: "UTC" });
const isOverdue = (t: Task) => !!t.dueDate && t.status !== "done" && isPastDue(t.dueDate);

export function TasksView() {
  const qc = useQueryClient();
  const campaignId = useApp((s) => s.currentCampaignId);
  const membership = useCurrentMembership();
  const isOwner = membership?.role === "owner";
  const userId = useSession().data?.user.id;
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // null = the default: members start on their own tasks, owners on everyone's.
  const [scope, setScope] = useState<"mine" | "all" | null>(null);
  const [person, setPerson] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const queryKey = ["tasks", campaignId];
  const { data, isLoading, isError, error, refetch, isFetching, fetchStatus } = useQuery<TasksData>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/tasks?campaignId=${campaignId}`);
      if (!r.ok) throw new Error("The server couldn't load tasks.");
      return r.json();
    },
    enabled: !!campaignId,
  });
  const { data: volunteersData } = useVolunteers(campaignId);
  const volunteers: Volunteer[] = volunteersData?.items ?? [];
  const mine = userId ? volunteers.find((v) => v.userId === userId) : undefined;
  const effectiveScope = scope ?? (mine && !isOwner ? "mine" : "all");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  async function changeStatus(task: Task, status: string, isUndo = false) {
    if (status === task.status) return;
    const previous = task.status;
    const patch = (s: string) =>
      qc.setQueryData<TasksData>(queryKey, (old) => old && { ...old, items: old.items.map((x) => (x.id === task.id ? { ...x, status: s } : x)) });
    patch(status);
    let r: Response | null = null;
    try {
      r = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status }),
      });
    } catch {
      // Offline: r stays null.
    }
    if (!r?.ok) {
      patch(previous);
      toast.error(`Couldn't move "${task.title}"`, {
        description: r ? "The server refused the change. Try again." : "No connection. Nothing was changed.",
      });
      return;
    }
    refresh();
    if (!isUndo) {
      toast(`Moved "${task.title}" to ${TASK_STATUS[status].label}`, {
        action: { label: "Undo", onClick: () => changeStatus({ ...task, status }, previous, true) },
      });
    }
  }

  // React Query pauses (rather than fails) requests while the device is offline.
  const offline = fetchStatus === "paused";
  if (isLoading && !offline) return <TasksSkeleton />;
  if (!data) {
    return (
      <div className="p-4 md:p-6">
        <Card className="py-12 text-center">
          <p className="text-sm font-medium">Couldn&apos;t load tasks.</p>
          <p className="text-sm text-muted-foreground">
            {offline || error instanceof TypeError ? "No connection." : (error?.message ?? "Something went wrong.")} Your tasks are safe; try again in a moment.
          </p>
          <div>
            <Button variant="outline" className="h-11 md:h-9" onClick={() => refetch()} disabled={isFetching}>Try again</Button>
          </div>
        </Card>
      </div>
    );
  }

  const tasks = data.items;
  const visible = tasks.filter(
    (t) =>
      (effectiveScope === "all" || t.assignedVolunteerId === mine?.id) &&
      (effectiveScope === "mine" || person === ALL || (person === "none" ? !t.assignedVolunteerId : t.assignedVolunteerId === person)) &&
      (priority === ALL || t.priority === priority) &&
      (!overdueOnly || isOverdue(t))
  );
  const filtered = visible.length !== tasks.length;
  const open = visible.filter((t) => t.status !== "done").length;
  const overdue = visible.filter(isOverdue).length;
  const blocked = visible.filter((t) => t.status === "blocked").length;
  const done = visible.length - open;
  const days = membership ? Math.max(0, Math.ceil((new Date(membership.electionDate).getTime() - Date.now()) / 86_400_000)) : null;
  const sortedVolunteers = [...volunteers].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  const clearFilters = () => {
    setScope("all");
    setPerson(ALL);
    setPriority(ALL);
    setOverdueOnly(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {(isError || offline) && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <span>{offline ? "You're offline." : "Couldn't refresh."} Showing the last tasks loaded.</span>
          <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={() => refetch()} disabled={isFetching}>Retry</Button>
        </div>
      )}

      {/* Header: summary against the election clock, and the one primary action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm tabular-nums">
          <span className="font-medium">{n(open)} open</span>
          {overdue > 0 && <span className="text-red-700 dark:text-red-400"> · {n(overdue)} overdue</span>}
          {days !== null && <span className="text-muted-foreground"> · {n(days)} days to election</span>}
        </p>
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          volunteers={volunteers}
          campaignId={campaignId}
          defaultAssigneeId={effectiveScope === "mine" ? mine?.id : undefined}
          onSaved={(title) => {
            refresh();
            toast(`Added "${title}"`);
            setCreateOpen(false);
          }}
        />
      </div>

      {/* Stats: desktop only; phones get the summary line above. */}
      <div className="hidden md:grid grid-cols-4 gap-3">
        <StatCard icon={ListTodo} label="Open" value={n(open)} sub={`${n(visible.filter((t) => t.status === "in-progress").length)} in progress`} accent="primary" />
        <StatCard icon={CalendarClock} label="Overdue" value={n(overdue)} sub="Past their due date" accent="rose" />
        <StatCard icon={AlertCircle} label="Blocked" value={n(blocked)} sub="Waiting on something" accent="rose" />
        <StatCard icon={CheckCircle2} label="Done" value={n(done)} sub={visible.length ? `${Math.round((done / visible.length) * 100)}% of ${n(visible.length)}` : "None yet"} accent="emerald" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter tasks">
        {mine && (
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Whose tasks">
            {(["mine", "all"] as const).map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={effectiveScope === s ? "secondary" : "ghost"}
                aria-pressed={effectiveScope === s}
                className="h-10 md:h-8"
                onClick={() => setScope(s)}
              >
                {s === "mine" ? "My tasks" : "Everyone"}
              </Button>
            ))}
          </div>
        )}
        {effectiveScope === "all" && (
          <Select value={person} onValueChange={setPerson}>
            <SelectTrigger aria-label="Assigned to" className={cn(selectClass, "w-auto min-w-40")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Anyone</SelectItem>
              <SelectItem value="none">Unassigned</SelectItem>
              {sortedVolunteers.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.firstName} {v.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger aria-label="Priority" className={cn(selectClass, "w-auto min-w-36")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any priority</SelectItem>
            {Object.entries(TASK_PRIORITY).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant={overdueOnly ? "secondary" : "outline"} aria-pressed={overdueOnly} className="h-11 md:h-9" onClick={() => setOverdueOnly((v) => !v)}>
          Overdue only
        </Button>
        {filtered && (
          <Button type="button" variant="link" className="h-11 md:h-9 px-1" onClick={clearFilters}>
            Show all {n(tasks.length)}
          </Button>
        )}
      </div>

      {data.truncated && (
        <p className="text-sm text-muted-foreground">Showing the 200 tasks due soonest. Finish or delete old tasks to see the rest.</p>
      )}

      {tasks.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No tasks yet. Add the first thing the team needs to get done before election day.</p>
          <div>
            <Button className="h-11 md:h-9" onClick={() => setCreateOpen(true)}>Add a task</Button>
          </div>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {effectiveScope === "mine" && !filtered ? "Nothing assigned to you." : "No tasks match these filters."}
          </p>
          <div>
            <Button variant="outline" className="h-11 md:h-9" onClick={clearFilters}>Show everyone&apos;s tasks</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {TASK_STATUSES.map((status) => {
            const info = TASK_STATUS[status];
            const Icon = info.icon;
            const items = visible.filter((t) => t.status === status);
            return (
              <Card key={status} className="gap-0 py-0" aria-labelledby={`col-${status}`}>
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 id={`col-${status}`} className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                    {info.label}
                  </h2>
                  <span className="text-xs tabular-nums text-muted-foreground">{n(items.length)}</span>
                </div>
                {items.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">{EMPTY_COLUMN[status]}</p>
                ) : (
                  <ul className="divide-y md:max-h-[640px] md:overflow-y-auto scroll-area-thin">
                    {items.map((t) => (
                      <TaskRow key={t.id} task={t} onOpen={() => setOpenId(t.id)} onStatus={(s) => changeStatus(t, s)} />
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <TaskSheet
        task={tasks.find((t) => t.id === openId) ?? null}
        volunteers={volunteers}
        canDelete={isOwner}
        onClose={() => setOpenId(null)}
        onSaved={(title) => {
          refresh();
          toast(`Saved "${title}"`);
          setOpenId(null);
        }}
        onDeleted={(title) => {
          refresh();
          toast(`Deleted "${title}"`);
          setOpenId(null);
        }}
      />
    </div>
  );
}

function TaskRow({ task: t, onOpen, onStatus }: { task: Task; onOpen: () => void; onStatus: (status: string) => void }) {
  const overdue = isOverdue(t);
  const urgent = t.priority === "urgent" || t.priority === "high";
  return (
    <li className="space-y-2 px-4 py-3">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:[&_.task-title]:underline underline-offset-4"
      >
        <span className="task-title block text-sm font-medium">{t.title}</span>
        {t.description && <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{t.description}</span>}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className={cn("rounded border px-1.5 text-[11px] font-medium", urgent && "text-foreground")}>{TASK_PRIORITY[t.priority] ?? t.priority}</span>
          {t.dueDate && (
            <span className={cn("tabular-nums", overdue && "font-medium text-red-700 dark:text-red-400")}>
              {overdue ? "Overdue · " : "Due "}
              {dueLabel(t.dueDate)}
            </span>
          )}
          <span>{t.volunteer ? `${t.volunteer.firstName} ${t.volunteer.lastName}` : "Unassigned"}</span>
          {t.voter && (
            <span className="flex items-center gap-1">
              <User className="size-3" aria-hidden />
              {t.voter.firstName} {t.voter.lastName}
            </span>
          )}
        </span>
      </button>
      <div className="flex items-center gap-2">
        <Select value={t.status} onValueChange={onStatus}>
          <SelectTrigger aria-label={`Status of ${t.title}`} className={cn(selectClass, "flex-1")}>
            <SelectValue>
              <StatusBadge color={TASK_STATUS[t.status]?.color ?? "slate"}>{TASK_STATUS[t.status]?.label ?? t.status}</StatusBadge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{TASK_STATUS[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {t.status !== "done" && (
          <Button type="button" variant="outline" className="h-11 md:h-9 shrink-0" onClick={() => onStatus("done")} aria-label={`Mark "${t.title}" done`}>
            <Check className="size-4" aria-hidden /> Done
          </Button>
        )}
      </div>
    </li>
  );
}

function TasksSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4" aria-busy="true">
      <span className="sr-only" role="status">Loading tasks…</span>
      <div className="h-11 rounded-lg bg-muted animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
