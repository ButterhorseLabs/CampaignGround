"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useMemberships } from "@/lib/memberships";
import { toast } from "sonner";
import { useSavingAction } from "@/lib/use-saving-action";
import { formatDate, formatTime } from "@/lib/format";
import { FUNNEL_STEPS, type FunnelRow, type FunnelStep, type FunnelSummary } from "@/lib/activation-funnel";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PlatformCampaign {
  id: string;
  candidateName: string;
  officeSought: string;
  district: string;
  createdAt: string;
  memberCount: number;
  owner: { name: string; email: string } | null;
}

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  isPlatformOwner: boolean;
  createdAt: string;
  memberships: { campaignName: string; role: string }[];
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

/** Fetches JSON and throws on a failed response, so errors never render as empty data. */
async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  return r.json();
}

export default function PlatformAdminPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlatformAdminContent />
    </QueryClientProvider>
  );
}

function PlatformAdminContent() {
  const memberships = useMemberships();
  const isPlatformOwner = memberships.data?.isPlatformOwner ?? false;

  const campaigns = useQuery({
    queryKey: ["platform", "campaigns"],
    queryFn: () => getJson<{ items: PlatformCampaign[] }>("/api/platform/campaigns"),
    enabled: isPlatformOwner,
  });
  const users = useQuery({
    queryKey: ["platform", "users"],
    queryFn: () => getJson<{ items: PlatformUser[] }>("/api/platform/users"),
    enabled: isPlatformOwner,
  });
  const funnel = useQuery({
    queryKey: ["platform", "funnel"],
    queryFn: () => getJson<{ summary: FunnelSummary; items: FunnelRow[] }>("/api/platform/funnel"),
    enabled: isPlatformOwner,
  });

  let body: React.ReactNode;
  if (memberships.isLoading) {
    body = (
      <p role="status" className="flex items-center gap-2 py-16 justify-center text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Checking your access…
      </p>
    );
  } else if (memberships.isError) {
    body = (
      <StatusCard title="Couldn't check your access" onRetry={() => memberships.refetch()}>
        The server didn&apos;t answer. Check your connection and try again.
      </StatusCard>
    );
  } else if (!isPlatformOwner) {
    body = (
      <StatusCard title="Not available">
        This page is only visible to the platform owner.
      </StatusCard>
    );
  } else {
    const updatedAt = funnel.dataUpdatedAt ? formatTime(new Date(funnel.dataUpdatedAt)) : null;
    body = (
      <>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Platform admin</h1>
            <p className="text-sm text-muted-foreground">
              Setup progress for every campaign on this deployment. What&apos;s inside each campaign stays private.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {updatedAt && <span aria-live="polite">Updated {updatedAt}</span>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 sm:h-8"
              disabled={funnel.isFetching}
              onClick={() => {
                funnel.refetch();
                campaigns.refetch();
                users.refetch();
              }}
            >
              <RefreshCw className={cn("size-3.5", funnel.isFetching && "animate-spin")} aria-hidden />
              Refresh
            </Button>
          </div>
        </div>

        <ActivationFunnel query={funnel} />

        <Disclosure
          title="Directory"
          summary={
            campaigns.data && users.data
              ? `${plural(campaigns.data.items.length, "campaign", "campaigns")} · ${plural(users.data.items.length, "account", "accounts")}`
              : undefined
          }
        >
          <CampaignsTable query={campaigns} />
          <UsersTable query={users} />
        </Disclosure>

        <Disclosure title="Danger zone" tone="danger" summary="Transfer platform ownership">
          <TransferOwnership users={users.data?.items ?? []} />
        </Disclosure>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center">
          <Link
            href="/dashboard"
            className="-ml-2 inline-flex h-11 sm:h-9 items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to app
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">{body}</main>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function StatusCard({ title, children, onRetry }: { title: string; children: React.ReactNode; onRetry?: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-sm p-6 gap-3">
      <h1 className="font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{children}</p>
      {onRetry && (
        <Button type="button" variant="outline" className="h-11 sm:h-9 self-start" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

/** Collapsed-by-default section; the summary line says what's inside. */
function Disclosure({ title, summary, tone, children }: {
  title: string;
  summary?: string;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <details className={cn("group rounded-xl border bg-card", tone === "danger" && "border-destructive/40")}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl px-4 md:px-6 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
        <h2 className={cn("text-base font-semibold", tone === "danger" && "text-destructive")}>{title}</h2>
        {summary && <span className="text-sm text-muted-foreground">{summary}</span>}
      </summary>
      <div className="space-y-6 border-t px-4 py-5 md:px-6">{children}</div>
    </details>
  );
}

function QueryRow({ colSpan, query, empty }: {
  colSpan: number;
  query: { isLoading: boolean; isError: boolean; refetch: () => unknown };
  empty: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-6 text-center text-muted-foreground">
        {query.isLoading ? (
          "Loading…"
        ) : query.isError ? (
          <span className="inline-flex flex-wrap items-center justify-center gap-3">
            Couldn&apos;t load this list.
            <Button type="button" variant="outline" size="sm" className="h-11 sm:h-8" onClick={() => query.refetch()}>
              Try again
            </Button>
          </span>
        ) : (
          empty
        )}
      </TableCell>
    </TableRow>
  );
}

const STEP_LABELS: Record<FunnelStep, string> = {
  signedUpAt: "Signed up",
  firstVoterAt: "Voters added",
  firstVolunteerAt: "Volunteer added",
  firstInviteAt: "Invite sent",
  activatedAt: "Activated",
};

function formatDuration(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 1) return "Under 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

/** Month, day and time; the year only when it isn't this year. */
function formatStepTime(iso: string): string {
  const sameYear = new Date(iso).getFullYear() === new Date().getFullYear();
  return formatDate(iso, { year: sameYear ? undefined : "numeric", hour: "numeric", minute: "2-digit" });
}

// Where new campaigns stall between signup and their first contact attempt.
// Setup progress only, never the contents of a campaign's records.
function ActivationFunnel({ query }: {
  query: UseQueryResult<{ summary: FunnelSummary; items: FunnelRow[] }>;
}) {
  const summary = query.data?.summary;
  const rows = query.data?.items ?? [];
  const median = summary?.medianSignupToActivationMs ?? null;
  const total = rows.length;

  return (
    <Card className="gap-5 px-4 py-5 xl:px-6">
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold">Activation funnel</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          The steps each campaign has reached since signing up. <strong className="font-medium text-foreground">Voters added</strong>:
          the first voter is on the list. <strong className="font-medium text-foreground">Volunteer added</strong>: someone
          besides the owner is on the roster. <strong className="font-medium text-foreground">Invite sent</strong>: the first
          teammate was invited. <strong className="font-medium text-foreground">Activated</strong>: someone logged a contact attempt.
        </p>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-4 border-y py-4">
        {FUNNEL_STEPS.map((step) => (
          <div key={step}>
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{STEP_LABELS[step]}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {summary ? summary.reached[step] : "—"}
              {summary && step !== "signedUpAt" && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">of {total}</span>
              )}
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Median signup to activation</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {median === null ? "—" : formatDuration(median)}
            {summary && summary.reached.activatedAt > 0 && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                from {plural(summary.reached.activatedAt, "campaign", "campaigns")}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <Table scrollLabel="Activation funnel by campaign">
        <caption className="sr-only">
          Activation funnel: when each campaign reached each setup step, newest campaign first.
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Campaign</TableHead>
            <TableHead scope="col">
              Team <span className="sr-only">size, including the owner</span>
            </TableHead>
            {FUNNEL_STEPS.map((step) => (
              <TableHead key={step} scope="col">{STEP_LABELS[step]}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading || query.isError || rows.length === 0 ? (
            <QueryRow colSpan={FUNNEL_STEPS.length + 2} query={query} empty="No campaigns yet." />
          ) : (
            rows.map((r) => (
              <TableRow key={r.campaignId}>
                <TableCell>
                  <div className="font-medium">{r.campaignName}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.officeSought}
                    {r.ownerName && <> · {r.ownerName}</>}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{r.teamSize}</TableCell>
                {FUNNEL_STEPS.map((step) => {
                  const at = r[step];
                  return (
                    <TableCell key={step} className="tabular-nums whitespace-nowrap">
                      {at ? (
                        formatStepTime(at)
                      ) : (
                        <>
                          <span aria-hidden className="text-muted-foreground">—</span>
                          <span className="sr-only">Not yet</span>
                        </>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function CampaignsTable({ query }: { query: UseQueryResult<{ items: PlatformCampaign[] }> }) {
  const campaigns = query.data?.items ?? [];
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Campaigns</h3>
      <Table scrollLabel="Campaigns">
        <caption className="sr-only">Every campaign on this deployment, newest first.</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Campaign</TableHead>
            <TableHead scope="col">Office</TableHead>
            <TableHead scope="col">District</TableHead>
            <TableHead scope="col">Owner</TableHead>
            <TableHead scope="col">Members</TableHead>
            <TableHead scope="col">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading || query.isError || campaigns.length === 0 ? (
            <QueryRow colSpan={6} query={query} empty="No campaigns yet." />
          ) : (
            campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.candidateName}</TableCell>
                <TableCell>{c.officeSought}</TableCell>
                <TableCell>{c.district}</TableCell>
                <TableCell>{c.owner ? `${c.owner.name} (${c.owner.email})` : "—"}</TableCell>
                <TableCell className="tabular-nums">{c.memberCount}</TableCell>
                <TableCell className="tabular-nums whitespace-nowrap">{formatDate(c.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}

function UsersTable({ query }: { query: UseQueryResult<{ items: PlatformUser[] }> }) {
  const users = query.data?.items ?? [];
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Accounts</h3>
      <Table scrollLabel="Accounts">
        <caption className="sr-only">Every account on this deployment, oldest first.</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Name</TableHead>
            <TableHead scope="col">Email</TableHead>
            <TableHead scope="col">Campaigns</TableHead>
            <TableHead scope="col">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading || query.isError || users.length === 0 ? (
            <QueryRow colSpan={4} query={query} empty="No accounts yet." />
          ) : (
            users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {u.name}
                    {u.isPlatformOwner && <Badge variant="secondary">Platform owner</Badge>}
                  </span>
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {u.memberships.length === 0
                    ? "—"
                    : u.memberships.map((m) => `${m.campaignName} (${m.role})`).join(", ")}
                </TableCell>
                <TableCell className="tabular-nums whitespace-nowrap">{formatDate(u.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}

function TransferOwnership({ users }: { users: PlatformUser[] }) {
  const id = useId();
  const qc = useQueryClient();
  const { saving, run } = useSavingAction();
  const [userId, setUserId] = useState("");
  const candidates = users.filter((u) => !u.isPlatformOwner);
  const target = candidates.find((u) => u.id === userId);

  async function transfer() {
    if (!target) return;
    await run(
      () =>
        fetch("/api/platform/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: target.email }),
        }),
      {
        onError: async (r) => {
          const body = await r.json().catch(() => null);
          toast.error(body?.error ?? "Couldn't transfer platform ownership. Try again.");
        },
        onSuccess: () => {
          setUserId("");
          toast(`${target.name} is now the platform owner`);
          qc.invalidateQueries({ queryKey: ["memberships"] });
          qc.invalidateQueries({ queryKey: ["platform"] });
        },
      }
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Hand deployment-wide access to another account. You lose access to this page until they hand it back.
      </p>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">There are no other accounts to transfer to yet.</p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-sm">
            <Label htmlFor={`${id}-owner`} className="text-xs">New platform owner</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id={`${id}-owner`} className="mt-1 w-full data-[size=default]:h-11 sm:data-[size=default]:h-9">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" className="h-11 sm:h-9" disabled={!target || saving}>
                Transfer ownership
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Transfer platform ownership?</AlertDialogTitle>
                <AlertDialogDescription>
                  {target ? `${target.name} (${target.email})` : "This account"} will become the platform owner.
                  You will lose access to this page until they hand it back.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={transfer}>
                  Transfer ownership
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
