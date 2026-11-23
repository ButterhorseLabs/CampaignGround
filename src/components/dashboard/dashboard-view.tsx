"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DashboardMetrics } from "@/lib/types";
import { SUPPORT_LEVELS } from "@/lib/types";
import { useApp, type Module } from "@/lib/store";
import { StatCard } from "@/components/common/stat-card";
import { FundraisingBar } from "@/components/common/fundraising-bar";
import { PartyBadge, StatusBadge, statusDot } from "@/components/common/badges";
import { ModuleLink } from "@/components/layout/module-link";
import { useCurrentRole } from "@/lib/memberships";
import { ImportVotersDialog } from "@/components/voters/import-voters-dialog";
import { OUTCOME_INFO as CANVASS_OUTCOMES } from "@/components/canvass/log-canvass-dialog";
import { OUTCOME_INFO as CALL_OUTCOMES } from "@/components/phonebank/log-call-dialog";
import { SetGoalsDialog } from "./set-goals-dialog";
import { TASK_STATUS } from "@/components/tasks/task-fields";
import {
  Users,
  HeartHandshake,
  DollarSign,
  DoorOpen,
  PhoneCall,
  CalendarDays,
  ListTodo,
  CheckCircle2,
  Clock,
  MapPin,
  Upload,
  UserPlus,
  Circle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCompactCurrency, formatCurrency, formatDate, formatTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const METHOD_LABEL: Record<string, string> = { online: "Online", check: "Check", cash: "Cash", "in-kind": "In-kind" };

const ACTIVITY_ICON = { donation: DollarSign, canvass: DoorOpen, call: PhoneCall, event: CalendarDays, task: ListTodo };

const n = (v: number) => v.toLocaleString("en-US");
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;
/** "Nov 8" for a YYYY-MM-DD day key, without shifting it through a time zone. */
const dayLabel = (day: string) => formatDate(`${day}T12:00:00Z`, { year: undefined, timeZone: "UTC" });

const linkButton = (variant: "default" | "outline" = "outline") => cn(buttonVariants({ variant, size: "sm" }), "h-11 md:h-9");

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <CardTitle className="text-base">
      <h2>{children}</h2>
    </CardTitle>
  );
}

export function DashboardView() {
  const campaignId = useApp((s) => s.currentCampaignId);
  const isOwner = useCurrentRole() === "owner";
  const [importOpen, setImportOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const { data, isLoading, isError, error, refetch, isFetching, fetchStatus, dataUpdatedAt } = useQuery<DashboardMetrics>({
    queryKey: ["dashboard", campaignId],
    queryFn: async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await fetch(`/api/dashboard?campaignId=${campaignId}&tz=${encodeURIComponent(tz)}`);
      if (r.status === 403) throw new Error("You no longer have access to this campaign.");
      if (!r.ok) throw new Error("The server couldn't put the numbers together.");
      return r.json();
    },
    enabled: !!campaignId,
    staleTime: 30_000,
    refetchInterval: 20_000,
  });

  // React Query pauses (rather than fails) requests while the device is offline.
  const offline = fetchStatus === "paused";
  if (isLoading && !offline) return <DashboardSkeleton />;
  // fetch rejects with a TypeError when the request never left the device.
  const cause = offline || error instanceof TypeError ? "No connection." : error?.message;
  if (!data) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">Couldn&apos;t load the dashboard.</p>
            <p className="text-sm text-muted-foreground mt-1">{cause ?? "Something went wrong."} Your data is safe; try again in a moment.</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-4 h-11 md:h-9">Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { campaign, totals, today } = data;
  const daysToElection = Math.max(0, Math.ceil((new Date(campaign.electionDate).getTime() - Date.now()) / 86_400_000));
  const nextEvent = data.upcomingEvents[0];
  const anyOutreach = totals.canvassVisits + totals.callsMade > 0;

  const supportCard = <SupportCard data={data} isOwner={isOwner} onImport={() => setImportOpen(true)} />;
  const eventsCard = (
    <Card>
      <CardHeader className="pb-3">
        <SectionTitle>Upcoming events</SectionTitle>
        <CardDescription className="text-xs">{plural(totals.upcomingEvents, "event")} on the schedule</CardDescription>
      </CardHeader>
      <CardContent>
        {data.upcomingEvents.length === 0 ? (
          <EmptyState text="Nothing on the schedule. Events bring in volunteers and voters." action={<ModuleLink module="events" className={linkButton()}>Plan an event</ModuleLink>} />
        ) : (
          <ul className="space-y-3">
            {data.upcomingEvents.map((e) => {
              const d = new Date(e.startTime);
              return (
                <li key={e.id} className="flex gap-3">
                  <div className="flex w-9 flex-col items-center pt-0.5" aria-hidden>
                    <div className="text-[11px] uppercase font-medium text-primary">{d.toLocaleString("en-US", { month: "short" })}</div>
                    <div className="text-lg font-semibold leading-none tabular-nums">{d.getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0 pb-3 border-b last:border-b-0">
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      <span className="sr-only">{formatDate(e.startTime, { weekday: "long", month: "long", year: undefined })}</span>
                      <span className="flex items-center gap-1"><Clock className="size-3" aria-hidden />{formatTime(e.startTime)}</span>
                      {e.location && <span className="flex items-center gap-1 min-w-0"><MapPin className="size-3 shrink-0" aria-hidden /><span className="truncate">{e.location}</span></span>}
                      <span className="tabular-nums">{plural(e.attendeeCount ?? 0, "RSVP")}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
  const precinctCard = (
    <Card>
      <CardHeader className="pb-3">
        <SectionTitle>Precincts</SectionTitle>
        <CardDescription className="text-xs">Supporters and voters talked to, of each precinct&apos;s voters in your list</CardDescription>
      </CardHeader>
      <CardContent>
        {data.precincts.length === 0 ? (
          <EmptyState text="Precinct numbers appear once voters in your list have a precinct." action={<ModuleLink module="voters" className={linkButton()}>Go to Voters</ModuleLink>} />
        ) : (
          <ul className="space-y-4">
            {data.precincts.map((p) => (
              <li key={p.name}>
                <div className="text-sm font-medium mb-1.5">{p.name}</div>
                <PrecinctBar label="Supporters" value={p.supporters} total={p.total} className="bg-primary" />
                <PrecinctBar label="Talked to" value={p.contacted} total={p.total} className="bg-highlight" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {(isError || offline) && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <span>
            {offline ? "You're offline." : <>Couldn&apos;t refresh. {cause}</>} Showing figures from {formatTime(new Date(dataUpdatedAt))}.
          </span>
          <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("size-3.5 mr-1", isFetching && "animate-spin")} aria-hidden /> Retry
          </Button>
        </div>
      )}

      {/* Campaign header: where the race stands */}
      <Card className="py-0">
        <CardContent className="p-5 md:p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{campaign.candidateName}</h2>
                <PartyBadge party={campaign.party} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {campaign.officeSought}
                {!campaign.officeSought.includes(campaign.district) && ` · ${campaign.district}`} · Election{" "}
                {formatDate(campaign.electionDate, { timeZone: "UTC" })}
              </p>
            </div>
            <div className="sm:text-right">
              <div className="text-2xl font-semibold tabular-nums text-primary">{n(daysToElection)}</div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Days to election</div>
            </div>
          </div>
          <VoteGoal
            supporters={totals.supporters}
            goal={campaign.voteGoal}
            days={daysToElection}
            onEdit={isOwner ? () => setGoalsOpen(true) : undefined}
          />
        </CardContent>
      </Card>

      <OnboardingChecklist totals={totals} isOwner={isOwner} onImport={() => setImportOpen(true)} />
      {isOwner && <ImportVotersDialog open={importOpen} onOpenChange={setImportOpen} campaignId={campaignId} />}
      {isOwner && goalsOpen && campaignId && (
        <SetGoalsDialog
          open
          onOpenChange={setGoalsOpen}
          campaignId={campaignId}
          voteGoal={campaign.voteGoal}
          fundraisingGoalCents={campaign.fundraisingGoalCents}
        />
      )}

      {/* Today: what needs doing now. Members see their own shift. */}
      <Card>
        <CardHeader className="pb-3">
          <SectionTitle>{isOwner ? "Today" : "Your shift"}</SectionTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3 md:gap-0 md:divide-x">
          <section aria-labelledby="today-tasks" className="md:pr-5 min-w-0">
            <h3 id="today-tasks" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              {isOwner ? "Due today or overdue" : "Your tasks"}
            </h3>
            {today.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isOwner ? "Nothing due today." : "No tasks assigned to you."}</p>
            ) : (
              <ul className="space-y-2">
                {today.tasks.map((t) => (
                  <li key={t.id} className="text-sm">
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.overdue ? (
                        <span className="font-medium text-red-700 dark:text-red-400">Overdue · {dayLabel(t.dueDate!)}</span>
                      ) : t.dueDate ? (
                        `Due ${dayLabel(t.dueDate)}`
                      ) : (
                        "No due date"
                      )}
                      {isOwner && ` · ${t.assignee ?? "Unassigned"}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ModuleLink module="tasks" className="mt-2 inline-flex min-h-11 md:min-h-0 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              All tasks
            </ModuleLink>
          </section>

          <section aria-labelledby="today-event" className="md:px-5 min-w-0 border-t pt-5 md:border-t-0 md:pt-0">
            <h3 id="today-event" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Next event</h3>
            {nextEvent ? (
              <div className="text-sm">
                <div className="truncate font-medium">{nextEvent.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(nextEvent.startTime, { weekday: "short", year: undefined })} · {formatTime(nextEvent.startTime)}
                  {nextEvent.location && ` · ${nextEvent.location}`}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">{plural(nextEvent.attendeeCount ?? 0, "RSVP")}</div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No events scheduled.</p>
            )}
            <ModuleLink module="events" className="mt-2 inline-flex min-h-11 md:min-h-0 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              {nextEvent ? "All events" : "Plan an event"}
            </ModuleLink>
          </section>

          <section aria-labelledby="today-outreach" className="md:pl-5 min-w-0 border-t pt-5 md:border-t-0 md:pt-0">
            <h3 id="today-outreach" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              {isOwner ? "Yesterday's outreach" : "Get started"}
            </h3>
            {isOwner ? (
              <ul className="text-sm space-y-1 tabular-nums">
                <li>
                  <ModuleLink module="canvass" className="inline-flex min-h-11 md:min-h-0 items-center gap-2 hover:underline underline-offset-4">
                    <DoorOpen className="size-4 text-muted-foreground" aria-hidden /> {plural(today.yesterday.visits, "door visit")}
                  </ModuleLink>
                </li>
                <li>
                  <ModuleLink module="phonebank" className="inline-flex min-h-11 md:min-h-0 items-center gap-2 hover:underline underline-offset-4">
                    <PhoneCall className="size-4 text-muted-foreground" aria-hidden /> {plural(today.yesterday.calls, "call")}
                  </ModuleLink>
                </li>
              </ul>
            ) : today.onRoster ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <ModuleLink module="canvass" className={linkButton("default")}><DoorOpen className="size-4" aria-hidden /> Start canvassing</ModuleLink>
                  <ModuleLink module="phonebank" className={linkButton()}><PhoneCall className="size-4" aria-hidden /> Start phone banking</ModuleLink>
                </div>
                <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                  Yesterday the team logged {plural(today.yesterday.visits, "door visit")} and {plural(today.yesterday.calls, "call")}.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask your campaign owner to add you to the volunteer roster, then you can knock doors and make calls here.
              </p>
            )}
          </section>
        </CardContent>
      </Card>

      {/* KPI grid: each figure opens its module */}
      <div className={cn("grid grid-cols-2 md:grid-cols-3 gap-3", data.fundraising ? "lg:grid-cols-6" : "lg:grid-cols-5")}>
        <Kpi module="voters" icon={Users} label="Voters in your list" value={n(totals.voters)} sub={`${n(totals.votersContacted)} talked to`} accent="primary" />
        <Kpi module="volunteers" icon={HeartHandshake} label="Volunteers" value={n(totals.volunteers)} sub="On the roster" accent="emerald" />
        {data.fundraising && (
          <Kpi
            module="donors"
            icon={DollarSign}
            label="Raised"
            value={formatCompactCurrency(data.fundraising.raisedCents)}
            sub={`${plural(data.fundraising.donors, "donor")} · ${plural(data.fundraising.donations, "gift")}`}
            accent="amber"
          />
        )}
        <Kpi module="canvass" icon={DoorOpen} label="Doors knocked" value={n(totals.canvassDoors)} sub={`${plural(totals.canvassVisits, "visit")} logged`} accent="violet" />
        <Kpi module="phonebank" icon={PhoneCall} label="Calls made" value={n(totals.callsMade)} sub={`${plural(totals.callsContacted, "conversation")}`} accent="primary" />
        <Kpi
          module="tasks"
          icon={ListTodo}
          label="Open tasks"
          value={n(totals.tasksOpen)}
          sub={totals.tasksOverdue > 0 ? `${n(totals.tasksOverdue)} overdue` : "None overdue"}
          accent="slate"
          className={data.fundraising ? undefined : "col-span-2 md:col-span-1"}
        />
      </div>

      {/* Fundraising is owner-only; the API returns null for members. */}
      {data.fundraising && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <SectionTitle>Fundraising</SectionTitle>
                  <CardDescription className="text-xs">
                    {data.fundraising.goalCents > 0
                      ? `${formatCurrency(data.fundraising.raisedCents)} raised of a ${formatCurrency(data.fundraising.goalCents)} goal`
                      : `${formatCurrency(data.fundraising.raisedCents)} raised · no goal set`}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={() => setGoalsOpen(true)}>
                  {data.fundraising.goalCents > 0 ? "Edit goal" : "Set a fundraising goal"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {data.fundraising.goalCents > 0 && <FundraisingBar raised={data.fundraising.raisedCents} goal={data.fundraising.goalCents} />}
              {data.fundraising.donations === 0 ? (
                <EmptyState text="No donations recorded yet." action={<ModuleLink module="donors" className={linkButton()}>Record a donation</ModuleLink>} />
              ) : (
                <>
                  <dl className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3">
                    {data.fundraising.byMethod.map((m) => (
                      <div key={m.method}>
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{METHOD_LABEL[m.method] ?? m.method}</dt>
                        <dd className="text-sm font-semibold tabular-nums">{formatCompactCurrency(m.totalCents)}</dd>
                      </div>
                    ))}
                  </dl>
                  <section aria-labelledby="recent-donations">
                    <h3 id="recent-donations" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Recent donations</h3>
                    <ul className="space-y-1">
                      {data.fundraising.recent.map((d) => (
                        <li key={d.id} className="flex items-center gap-3 py-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{d.donor ? `${d.donor.firstName} ${d.donor.lastName}` : "Unknown donor"}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {METHOD_LABEL[d.method] ?? d.method}
                              {d.inKindDescription ? ` · ${d.inKindDescription}` : ""} · {relativeTime(d.donationDate)}
                            </div>
                          </div>
                          <div className="text-sm font-semibold tabular-nums">{formatCurrency(d.amountCents)}</div>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
            </CardContent>
          </Card>

          {supportCard}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <SectionTitle>Outreach, last 14 days</SectionTitle>
            <CardDescription className="text-xs">Door visits and calls logged each day</CardDescription>
          </CardHeader>
          <CardContent>
            {anyOutreach ? (
              <OutreachChart byDay={data.outreach.byDay} />
            ) : (
              <EmptyState
                text="No door visits or calls logged yet. Daily outreach shows up here once the team starts."
                action={
                  <div className="flex flex-wrap gap-2">
                    <ModuleLink module="canvass" className={linkButton()}>Go to Canvassing</ModuleLink>
                    <ModuleLink module="phonebank" className={linkButton()}>Go to Phone bank</ModuleLink>
                  </div>
                }
              />
            )}
          </CardContent>
        </Card>

        {data.fundraising ? eventsCard : supportCard}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <SectionTitle>Recent activity</SectionTitle>
            <CardDescription className="text-xs">
              {data.fundraising ? "Latest donations, contacts, events, and tasks" : "Latest contacts, events, and tasks"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <EmptyState text="Nothing yet. Logged visits, calls, and task updates appear here." />
            ) : (
              <ul className="divide-y">
                {data.recentActivity.map((a) => {
                  const Icon = ACTIVITY_ICON[a.kind];
                  const status =
                    a.kind === "canvass" ? CANVASS_OUTCOMES[a.status ?? ""] :
                    a.kind === "call" ? CALL_OUTCOMES[a.status ?? ""] :
                    a.kind === "task" ? TASK_STATUS[a.status ?? ""] : undefined;
                  return (
                    <li key={`${a.kind}-${a.at}-${a.label}`} className="flex items-center gap-3 py-2">
                      <div className="size-8 shrink-0 rounded-md grid place-items-center bg-muted text-muted-foreground">
                        <Icon className="size-4" aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{a.label}</div>
                        {(status || a.sub) && (
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                            {status && <StatusBadge color={status.color}>{status.label}</StatusBadge>}
                            {a.sub && <span className="truncate tabular-nums">{a.sub}</span>}
                          </div>
                        )}
                      </div>
                      <time dateTime={a.at} className="text-xs text-muted-foreground whitespace-nowrap">{relativeTime(a.at)}</time>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {data.fundraising ? precinctCard : (
          <div className="space-y-6">
            {eventsCard}
            {precinctCard}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ module, className, ...card }: React.ComponentProps<typeof StatCard> & { module: Module }) {
  return (
    <ModuleLink
      module={module}
      className={cn("group block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", className)}
    >
      <StatCard {...card} className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-accent/30" />
    </ModuleLink>
  );
}

function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

function VoteGoal({ supporters, goal, days, onEdit }: { supporters: number; goal: number; days: number; onEdit?: () => void }) {
  const toGo = Math.max(0, goal - supporters);
  const pace =
    toGo === 0 ? "Goal reached." :
    days === 0 ? `${n(toGo)} to go on election day.` :
    `${n(toGo)} to go · about ${n(Math.ceil(toGo / days))} a day for ${plural(days, "day")}`;
  return (
    <div className="border-t pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm">
          <span className="text-2xl font-semibold tabular-nums">{n(supporters)}</span>
          {goal > 0 && <span className="text-muted-foreground tabular-nums"> of {n(goal)}</span>} supporters
        </p>
        {onEdit && (
          <Button variant="link" size="sm" className="h-11 md:h-auto px-0" onClick={onEdit}>
            {goal > 0 ? "Edit goals" : "Set a vote goal"}
          </Button>
        )}
      </div>
      {goal > 0 && (
        <>
          <Progress value={Math.min(100, (supporters / goal) * 100)} aria-label="Supporters toward vote goal" className="mt-2 h-2.5" />
          <p className="text-sm text-muted-foreground mt-2 tabular-nums">{pace}</p>
        </>
      )}
      <p className="text-xs text-muted-foreground mt-1">Supporters are voters in your list marked strong or lean support.</p>
    </div>
  );
}

function SupportCard({ data, isOwner, onImport }: { data: DashboardMetrics; isOwner: boolean; onImport: () => void }) {
  const counts = SUPPORT_LEVELS.map((l) => ({
    ...l,
    count: data.outreach.supportBreakdown.find((s) => s.level === l.value)?.count ?? 0,
  }));
  const total = counts.reduce((acc, l) => acc + l.count, 0);
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionTitle>Support</SectionTitle>
        <CardDescription className="text-xs">How the {plural(total, "voter")} in your list lean</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            text="No voters yet. Import your list to start tracking support."
            action={
              isOwner ? (
                <Button size="sm" className="h-11 md:h-9" onClick={onImport}><Upload className="size-3.5 mr-1" aria-hidden /> Import voter list</Button>
              ) : (
                <ModuleLink module="voters" className={linkButton()}>Go to Voters</ModuleLink>
              )
            }
          />
        ) : (
          <>
            <div className="flex h-3 gap-px overflow-hidden rounded-full bg-secondary" aria-hidden>
              {counts.filter((l) => l.count > 0).map((l) => (
                <div key={l.value} className={statusDot(l.color)} style={{ width: `${pct(l.count)}%` }} />
              ))}
            </div>
            <ul className="mt-4 space-y-1.5">
              {counts.map((l) => (
                <li key={l.value} className="flex items-center gap-2 text-sm">
                  <span className={cn("size-2.5 shrink-0 rounded-full", statusDot(l.color))} aria-hidden />
                  <span className="flex-1">{l.label}</span>
                  <span className="tabular-nums font-medium">{n(l.count)}</span>
                  <span className="w-10 text-right tabular-nums text-muted-foreground">{pct(l.count).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PrecinctBar({ label, value, total, className }: { label: string; value: number; total: number; className: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden" aria-hidden>
          <div className={cn("h-full", className)} style={{ width: `${pct}%` }} />
        </div>
        <span className="whitespace-nowrap tabular-nums">{n(value)} of {n(total)} · {pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function OutreachChart({ byDay }: { byDay: DashboardMetrics["outreach"]["byDay"] }) {
  const rows = byDay.map((d) => ({ day: dayLabel(d.date), Visits: d.visits, Calls: d.calls }));
  const visits = byDay.reduce((s, d) => s + d.visits, 0);
  const calls = byDay.reduce((s, d) => s + d.calls, 0);
  const busiest = byDay.reduce((best, d) => (d.visits + d.calls > best.visits + best.calls ? d : best), byDay[0]);
  const axis = { fontSize: 12, fill: "var(--muted-foreground)" };
  return (
    <>
      <p className="sr-only">
        {`Last 14 days: ${plural(visits, "door visit")} and ${plural(calls, "call")}.`}
        {busiest && busiest.visits + busiest.calls > 0 && ` Busiest day ${dayLabel(busiest.date)}, with ${busiest.visits + busiest.calls}.`}
      </p>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={1}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={axis} stroke="var(--border)" tickLine={false} minTickGap={16} />
            <YAxis tick={axis} stroke="var(--border)" tickLine={false} axisLine={false} allowDecimals={false} width={32} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{ fontSize: 12, borderRadius: 8, background: "var(--popover)", borderColor: "var(--border)", color: "var(--popover-foreground)" }}
            />
            <Bar dataKey="Visits" fill="var(--chart-1)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="Calls" fill="var(--chart-2)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground mt-2 tabular-nums" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-1" />Door visits · {n(visits)}</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-2" />Calls · {n(calls)}</span>
      </div>
    </>
  );
}

function OnboardingChecklist({ totals, isOwner, onImport }: {
  totals: DashboardMetrics["totals"];
  isOwner: boolean;
  onImport: () => void;
}) {
  const steps: { title: string; done: boolean; detail: React.ReactNode; action?: React.ReactNode }[] = [
    {
      title: "Import your voter list",
      done: totals.voters > 0,
      detail: isOwner
        ? "Upload a CSV from your county or a spreadsheet."
        : "Ask your campaign owner to import the voter list. You can add voters one at a time on the Voters page.",
      action: isOwner ? (
        <Button type="button" size="sm" className="h-11 md:h-8" onClick={onImport}>
          <Upload className="size-3.5 mr-1" aria-hidden /> Import voter list
        </Button>
      ) : (
        <ModuleLink module="voters" className={linkButton()}>Go to Voters</ModuleLink>
      ),
    },
    {
      title: "Add your first volunteer",
      // Signup puts the owner on the roster, so the first volunteer is the second entry.
      done: totals.volunteers > 1,
      detail: "You're on the roster already. Add the people helping you, then assign tasks and outreach.",
      action: <ModuleLink module="volunteers" className={linkButton()}>Go to Volunteers</ModuleLink>,
    },
  ];
  if (isOwner) {
    steps.push({
      title: "Invite your team",
      done: totals.teammates > 1 || totals.invitesSent > 0,
      detail: (
        <>
          Use the invite button (<UserPlus className="inline size-3 align-[-2px]" aria-label="person with a plus sign" />) at the top of the page to give teammates their own login.
        </>
      ),
    });
  }
  const doneCount = steps.filter((s) => s.done).length;
  // Stays until voters and volunteers exist, so importing voters doesn't hide
  // the rest. Inviting alone never keeps it up: solo campaigns are valid, and
  // the invite button is always in the top bar.
  if (steps[0].done && steps[1].done) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionTitle>Get your campaign ready</SectionTitle>
        <CardDescription className="text-xs">{doneCount} of {steps.length} done</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="divide-y border-t">
          {steps.map((s) => (
            <li key={s.title} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {s.done ? (
                  <CheckCircle2 className="size-5 text-primary shrink-0" aria-hidden />
                ) : (
                  <Circle className="size-5 text-muted-foreground shrink-0" aria-hidden />
                )}
                <div className="min-w-0">
                  <div className={s.done ? "text-sm font-medium text-muted-foreground" : "text-sm font-medium"}>
                    {s.title}
                    {s.done && <span className="sr-only"> (done)</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>
                </div>
              </div>
              {!s.done && s.action && <div className="sm:shrink-0 pl-8 sm:pl-0">{s.action}</div>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6" aria-busy="true">
      <span className="sr-only" role="status">Loading the dashboard…</span>
      <div className="h-40 rounded-xl bg-muted animate-pulse" />
      <div className="h-32 rounded-xl bg-muted animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
