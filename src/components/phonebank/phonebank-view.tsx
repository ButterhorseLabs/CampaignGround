"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneCall, PhoneOff, Phone, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { StatusBadge, SupportBadge } from "@/components/common/badges";
import { StatCard } from "@/components/common/stat-card";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { issueLabel, type CallLog, type Volunteer } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useClaims } from "@/lib/claims";
import { ActingAsPicker } from "@/components/common/acting-as-picker";
import { useVolunteers } from "@/lib/volunteers";
import { useSavingAction } from "@/lib/use-saving-action";
import { useStoredState } from "@/lib/use-stored-state";
import { buildCallScript } from "@/lib/call-script";
import { ContactedCallDialog, OUTCOME_INFO, type ContactedDetails } from "@/components/phonebank/log-call-dialog";

interface CallLogRow extends CallLog {
  voter?: (CallLog["voter"] & { precinct?: { name: string } | null }) | null;
}

interface CallSummary {
  calls: number;
  contacted: number;
  noAnswer: number;
  avgLengthSec: number;
}

interface QueueVoter {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  supportLevel: string;
  precinctName: string | null;
  lastOutcome: string | null;
  lastCalledAt: string | null;
}

interface QueueResponse {
  items: QueueVoter[];
  /** Voters left to call, beyond the ones sent. */
  remaining: number;
  campaign: { candidateName: string; officeSought: string; district: string; electionDate: string };
}

const OUTCOMES = Object.keys(OUTCOME_INFO);
const CHOOSE_VOLUNTEER = "Choose who's calling before you start the queue.";

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  return r.json();
}

const minutes = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export function PhoneBankView() {
  const qc = useQueryClient();
  const { saving, run } = useSavingAction();
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [contactedOpen, setContactedOpen] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<string | null>(null);
  const [volunteerError, setVolunteerError] = useState("");
  // This session only: voters passed over, voters just logged (until the queue refetches), and the call count.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [sessionCalls, setSessionCalls] = useState(0);
  // When the caller tapped the number, for the current voter only.
  const [timer, setTimer] = useState<{ voterId: string; startedAt: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const campaignId = useApp((s) => s.currentCampaignId);

  // Remembered per campaign, so a reload keeps who's calling.
  const [storedVolunteerId, setStoredVolunteerId] = useStoredState(`cg:call-as:${campaignId}`);
  const { data: volunteersData } = useVolunteers(campaignId);
  const volunteers: Volunteer[] = volunteersData?.items ?? [];
  const activeVolunteer = volunteers.find((v) => v.id === storedVolunteerId);
  const activeVolunteerId = activeVolunteer?.id ?? "";

  const logParams = new URLSearchParams();
  if (campaignId) logParams.set("campaignId", campaignId);
  if (outcomeFilter !== "all") logParams.set("outcome", outcomeFilter);
  const logsQuery = useQuery({
    queryKey: ["call-logs", logParams.toString()],
    queryFn: () => getJson<{ items: CallLogRow[]; summary: CallSummary }>(`/api/calls?${logParams}`),
    enabled: !!campaignId,
    refetchInterval: 10_000,
  });
  const logs = logsQuery.data?.items ?? [];
  const summary = logsQuery.data?.summary;

  const queueQuery = useQuery({
    queryKey: ["call-queue", campaignId, activeVolunteerId],
    queryFn: () => getJson<QueueResponse>(`/api/calls/queue?campaignId=${campaignId}&volunteerId=${activeVolunteerId}`),
    enabled: !!campaignId && !!activeVolunteerId,
    refetchInterval: 30_000,
  });

  const { claimedByOthers, claim, release } = useClaims("call", campaignId, activeVolunteerId);

  const queue = (queueQuery.data?.items ?? []).filter(
    (v) => !skipped.has(v.id) && !logged.has(v.id) && !claimedByOthers.has(v.id)
  );
  const current = queue[0];
  const startedAt = timer && timer.voterId === current?.id ? timer.startedAt : null;

  // Hold the current voter while they're on screen so no other caller dials them.
  useEffect(() => {
    if (!current || !activeVolunteerId) return;
    let cancelled = false;
    claim(current.id, activeVolunteerId).then(async (r) => {
      if (cancelled || r.status !== 409) return;
      const body = await r.json();
      toast(`${body.claimedBy} is calling ${current.firstName}, moving on`, { duration: 2500 });
      setSkipped((s) => new Set(s).add(current.id));
    });
    return () => {
      cancelled = true;
      release(current.id, activeVolunteerId);
    };
  }, [current?.id, activeVolunteerId]);

  function chooseVolunteer(id: string) {
    setStoredVolunteerId(id);
    setVolunteerError("");
  }

  function requireVolunteer(): boolean {
    if (activeVolunteer) return true;
    setVolunteerError(CHOOSE_VOLUNTEER);
    pickerRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    pickerRef.current?.querySelector<HTMLElement>("button, [role=combobox]")?.focus({ preventScroll: true });
    return false;
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["call-logs"] });
    qc.invalidateQueries({ queryKey: ["call-queue"] });
    qc.invalidateQueries({ queryKey: ["voters"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function undo(log: CallLog) {
    const r = await fetch(`/api/calls?id=${log.id}&campaignId=${log.campaignId}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) {
      const body = await r?.json().catch(() => null);
      toast.error("Couldn't undo", { description: body?.error ?? "Check your connection and try again." });
      return;
    }
    setLogged((s) => {
      const next = new Set(s);
      if (log.voterId) next.delete(log.voterId);
      return next;
    });
    setSessionCalls((n) => Math.max(0, n - 1));
    refresh();
    toast("Call removed");
  }

  async function logCall(voter: QueueVoter, outcome: string, details?: ContactedDetails) {
    if (!requireVolunteer()) return;
    setPendingOutcome(outcome);
    let res: Response | undefined;
    await run(
      async () =>
        (res = await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voterId: voter.id,
            volunteerId: activeVolunteerId,
            campaignId,
            outcome,
            callLengthSec: startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0,
            ...details,
          }),
        })),
      {
        onError: async (r) => {
          const body = await r.json().catch(() => null);
          toast.error("Couldn't save this call", { description: body?.error ?? "Try again in a moment." });
        },
        onSuccess: async () => {
          const log: CallLog = await res!.json();
          setLogged((s) => new Set(s).add(voter.id));
          setSessionCalls((n) => n + 1);
          setContactedOpen(false);
          refresh();
          // Calls that changed the voter's record can't be undone here (the API refuses them).
          toast.success(`${OUTCOME_INFO[outcome].label}: ${voter.firstName} ${voter.lastName}`, {
            duration: 6000,
            action: log.supportLevel ? undefined : { label: "Undo", onClick: () => undo(log) },
          });
        },
      }
    );
    setPendingOutcome(null);
  }

  function choose(outcome: string) {
    if (!current || pendingOutcome) return;
    if (outcome === "contacted") setContactedOpen(true);
    else logCall(current, outcome);
  }

  function skip() {
    if (!current) return;
    const voter = current;
    setSkipped((s) => new Set(s).add(voter.id));
    toast(`Skipped ${voter.firstName} ${voter.lastName}`, {
      action: {
        label: "Undo",
        onClick: () =>
          setSkipped((s) => {
            const next = new Set(s);
            next.delete(voter.id);
            return next;
          }),
      },
    });
  }

  // Keyboard: 1–6 pick an outcome, S skips. Ignored while typing or with a dialog open.
  // Re-subscribed each render so the handler always sees the current voter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || contactedOpen || !current) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [role=combobox], [role=dialog], [contenteditable=true]")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= OUTCOMES.length) {
        e.preventDefault();
        choose(OUTCOMES[n - 1]);
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const contactRate = summary && summary.calls > 0 ? (summary.contacted / summary.calls) * 100 : 0;
  const filterLabel = OUTCOME_INFO[outcomeFilter]?.label;
  const campaign = queueQuery.data?.campaign;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div ref={pickerRef}>
        <ActingAsPicker label="Calling as" campaignId={campaignId} value={activeVolunteerId} onChange={chooseVolunteer} error={volunteerError} />
      </div>

      {/* Campaign-wide totals are for the manager at a desk; on a phone the call comes first. */}
      {summary && (
        <div className="hidden md:grid md:grid-cols-4 gap-3">
          <StatCard icon={PhoneCall} label="Calls made" value={summary.calls} sub={`${summary.contacted} conversations`} accent="primary" />
          <StatCard icon={CheckCircle2} label="Contact rate" value={`${contactRate.toFixed(0)}%`} sub="Conversations per call" accent="emerald" />
          <StatCard icon={PhoneOff} label="No answer" value={summary.noAnswer} sub="Back in the queue after a day" accent="amber" />
          <StatCard
            icon={Clock}
            label="Avg call length"
            value={summary.avgLengthSec > 0 ? minutes(summary.avgLengthSec) : "—"}
            sub="Calls timed from the dial button"
            accent="violet"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 gap-4">
          <CardHeader>
            <CardTitle className="text-base"><h2>Call queue</h2></CardTitle>
            <CardDescription className="text-xs">
              Undecided and leaning voters with a phone number. Wrong numbers and refusals drop off; unanswered calls come back after a day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!activeVolunteer ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Choose who's calling above to start the queue.</p>
            ) : queueQuery.isError ? (
              <div className="py-10 text-center text-sm">
                <p className="text-muted-foreground">The queue didn't load.</p>
                <Button variant="outline" className="mt-3 h-11 md:h-9" onClick={() => queueQuery.refetch()}>Try again</Button>
              </div>
            ) : !queueQuery.data ? (
              <QueueSkeleton />
            ) : current && campaign ? (
              <CallCard
                key={current.id}
                voter={current}
                callerFirstName={activeVolunteer.firstName}
                campaign={campaign}
                startedAt={startedAt}
                onDial={() => setTimer((t) => (t?.voterId === current.id ? t : { voterId: current.id, startedAt: Date.now() }))}
                pendingOutcome={pendingOutcome}
                onChoose={choose}
                onSkip={skip}
                left={Math.max(0, queueQuery.data.remaining - logged.size - skipped.size)}
                sessionCalls={sessionCalls}
              />
            ) : (
              <QueueFinished
                sessionCalls={sessionCalls}
                skipped={skipped.size}
                onRestart={() => setSkipped(new Set())}
              />
            )}
          </CardContent>
        </Card>

        <Card className="hidden md:flex lg:col-span-2 overflow-hidden gap-0 pb-0">
          <CardHeader className="pb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base"><h2>Recent calls</h2></CardTitle>
              <CardDescription className="text-xs">Newest first, from every caller</CardDescription>
            </div>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger aria-label="Filter by outcome" className="w-[160px] text-xs data-[size=default]:h-9">
                <SelectValue placeholder="All outcomes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                {Object.entries(OUTCOME_INFO).map(([k, info]) => (
                  <SelectItem key={k} value={k}>{info.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[640px] overflow-y-auto scroll-area-thin border-t">
              {logsQuery.isError ? (
                <div className="px-4 py-12 text-center text-sm">
                  <p className="text-muted-foreground">Recent calls didn't load.</p>
                  <Button variant="outline" className="mt-3 h-9" onClick={() => logsQuery.refetch()}>Try again</Button>
                </div>
              ) : logsQuery.isLoading ? (
                <LogSkeleton />
              ) : logs.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {filterLabel ? `No “${filterLabel}” calls yet.` : "No calls logged yet. Choose who's calling and start the queue."}
                </p>
              ) : (
                <ul>
                  {logs.map((l) => {
                    const info = OUTCOME_INFO[l.outcome] ?? OUTCOME_INFO["no-answer"];
                    return (
                      <li key={l.id} className="px-4 py-3 border-b last:border-b-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{l.voter ? `${l.voter.firstName} ${l.voter.lastName}` : "Unknown voter"}</span>
                          <StatusBadge color={info.color}>{info.label}</StatusBadge>
                          {l.supportLevel && <SupportBadge level={l.supportLevel} />}
                          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                            {l.callLengthSec > 0 && <>{minutes(l.callLengthSec)} · </>}
                            {relativeTime(l.calledAt)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                          {l.voter?.precinct?.name && <span>{l.voter.precinct.name}</span>}
                          {l.volunteer && <span>· {l.volunteer.firstName} {l.volunteer.lastName}</span>}
                          {l.issuePriority && <span>· Issue: {issueLabel(l.issuePriority)}</span>}
                        </div>
                        {l.notes && <p className="text-xs mt-1.5 text-foreground/80 bg-muted/40 px-2 py-1 rounded">“{l.notes}”</p>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {current && activeVolunteer && (
        <ContactedCallDialog
          key={current.id}
          open={contactedOpen}
          onOpenChange={setContactedOpen}
          voterName={`${current.firstName} ${current.lastName}`}
          callerName={`${activeVolunteer.firstName} ${activeVolunteer.lastName}`}
          saving={saving}
          onSave={(details) => logCall(current, "contacted", details)}
        />
      )}
    </div>
  );
}

function CallCard({ voter, callerFirstName, campaign, startedAt, onDial, pendingOutcome, onChoose, onSkip, left, sessionCalls }: {
  voter: QueueVoter;
  callerFirstName: string;
  campaign: QueueResponse["campaign"];
  startedAt: number | null;
  onDial: () => void;
  pendingOutcome: string | null;
  onChoose: (outcome: string) => void;
  onSkip: () => void;
  left: number;
  sessionCalls: number;
}) {
  const script = buildCallScript({
    voterFirstName: voter.firstName,
    callerFirstName,
    candidateName: campaign.candidateName,
    officeSought: campaign.officeSought,
    district: campaign.district,
    electionDate: campaign.electionDate,
  });
  const last = voter.lastOutcome ? OUTCOME_INFO[voter.lastOutcome] : null;

  return (
    <div className="space-y-5">
      <section aria-label="Voter">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-lg font-semibold">{voter.firstName} {voter.lastName}</p>
          <SupportBadge level={voter.supportLevel} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {voter.precinctName ?? "No precinct"}
          {last && voter.lastCalledAt && <> · Last call: {last.label.toLowerCase()}, {relativeTime(voter.lastCalledAt)}</>}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href={`tel:${voter.phone}`}
            onClick={onDial}
            className={cn(buttonVariants({ variant: "outline" }), "h-12 px-4 text-base tabular-nums")}
          >
            <Phone className="size-4" aria-hidden />
            Call {voter.phone}
          </a>
          {startedAt ? <CallTimer startedAt={startedAt} /> : (
            <span className="text-xs text-muted-foreground">Tap to dial; the call is timed from here.</span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Held for you: other callers skip {voter.firstName} while you're on this call.</p>
      </section>

      <section aria-labelledby="call-script-heading" className="rounded-lg bg-muted/40 p-4">
        <h3 id="call-script-heading" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Script</h3>
        <div className="space-y-2 text-[15px] leading-relaxed">
          {script.map((line) => {
            const cue = /^\((.+?)\)\s*(.*)$/.exec(line);
            return cue ? (
              <p key={line}><span className="text-muted-foreground">If {cue[1].replace(/^If /i, "").toLowerCase()}:</span> {cue[2]}</p>
            ) : (
              <p key={line}>{line}</p>
            );
          })}
        </div>
      </section>

      <fieldset>
        <legend className="text-sm font-medium mb-2">How did it go?</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {OUTCOMES.map((outcome, i) => (
            <Button
              key={outcome}
              type="button"
              variant={outcome === "contacted" ? "default" : "outline"}
              className="h-11 justify-start md:h-10"
              disabled={pendingOutcome !== null}
              onClick={() => onChoose(outcome)}
            >
              {pendingOutcome === outcome && <Loader2 className="size-4 animate-spin" aria-hidden />}
              <span className="flex-1 text-left">{OUTCOME_INFO[outcome].label}</span>
              <kbd className="hidden md:inline text-[11px] font-sans opacity-60" aria-hidden>{i + 1}</kbd>
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {left.toLocaleString()} left to call · {sessionCalls} {sessionCalls === 1 ? "call" : "calls"} this session
        </span>
        <Button type="button" variant="ghost" className="h-11 md:h-8" onClick={onSkip}>
          Skip for now <kbd className="hidden md:inline text-[11px] font-sans opacity-60" aria-hidden>S</kbd>
        </Button>
      </div>
    </div>
  );
}

function CallTimer({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-sm font-medium tabular-nums">
      On the call · {minutes(Math.max(0, (now - startedAt) / 1000))}
    </span>
  );
}

function QueueFinished({ sessionCalls, skipped, onRestart }: { sessionCalls: number; skipped: number; onRestart: () => void }) {
  return (
    <div className="py-10 text-center">
      <p className="font-medium">{sessionCalls > 0 ? "Queue finished. Thank you!" : "Nobody to call right now."}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {sessionCalls > 0 && <>{sessionCalls} {sessionCalls === 1 ? "call" : "calls"} this session. </>}
        Unanswered calls come back after a day.
      </p>
      {skipped > 0 && (
        <Button variant="outline" className="mt-4 h-11 md:h-9" onClick={onRestart}>
          Call the {skipped} you skipped
        </Button>
      )}
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="h-6 w-1/3 rounded bg-muted animate-pulse" />
      <div className="h-12 w-48 rounded-md bg-muted/60 animate-pulse" />
      <div className="h-36 rounded-lg bg-muted/40 animate-pulse" />
    </div>
  );
}

function LogSkeleton() {
  return (
    <ul aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="px-4 py-3 border-b last:border-b-0 space-y-2">
          <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted/60 animate-pulse" />
        </li>
      ))}
    </ul>
  );
}
