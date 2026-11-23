"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import { AuthField, authControlClass, focusFirstInvalid } from "@/components/auth/auth-field";
import { PASSWORD_RULE } from "@/lib/validation/signup";

type InviteInfo = {
  email: string;
  campaignName: string;
  officeSought: string;
  status: "pending" | "accepted" | "revoked" | "expired" | "bounced";
};

/** "missing": no such invite. "failed": couldn't check (offline, rate limited, server error). */
type LoadError = { kind: "missing" } | { kind: "failed"; message: string };

const ASK_OWNER = "Ask the campaign owner to send you a new invite.";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoadError(null);
    const r = await fetch(`/api/invites/token/${token}`).catch(() => null);
    if (!r) return setLoadError({ kind: "failed", message: "No connection. Check your signal and try again." });
    if (r.status === 404) return setLoadError({ kind: "missing" });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      return setLoadError({ kind: "failed", message: body?.error ?? "Couldn't load this invite. Try again in a minute." });
    }
    setInvite(await r.json());
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  /** Shared failure handling for both accept paths. */
  async function acceptFailed(r: Response | null) {
    if (!r) return setFormError("No connection. Nothing was saved; try again when you're back online.");
    const body = await r.json().catch(() => ({}));
    const issues: { path: string; message: string }[] = Array.isArray(body?.issues) ? body.issues : [];
    if (issues.length > 0) {
      const map: Record<string, string> = {};
      for (const i of issues) map[i.path] ??= i.message;
      setFieldErrors(map);
      setFormError("Fix the highlighted fields and try again.");
      focusFirstInvalid();
      return;
    }
    setFormError(r.status === 410 ? `${body?.error ?? "This invite is no longer valid"}. ${ASK_OWNER}` : (body?.error ?? "Couldn't accept the invite. Try again in a minute."));
  }

  async function acceptLoggedIn() {
    setSubmitting(true);
    setFormError(null);
    const r = await fetch(`/api/invites/token/${token}/accept`, { method: "POST" }).catch(() => null);
    setSubmitting(false);
    if (!r?.ok) return acceptFailed(r);
    router.push("/dashboard");
    router.refresh();
  }

  async function acceptNewAccount(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const r = await fetch(`/api/invites/token/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    }).catch(() => null);

    if (r?.status === 409) {
      const body = await r.json().catch(() => ({}));
      if (body?.requiresLogin) {
        setNeedsLogin(true);
        setSubmitting(false);
        return;
      }
    }
    if (!r?.ok) {
      setSubmitting(false);
      return acceptFailed(r);
    }

    const result = await signIn("credentials", { email: invite?.email, password, redirect: false });
    if (result?.error) {
      // The account and membership exist; logging in by hand finishes the job.
      router.push(`/login?created=1&email=${encodeURIComponent(invite?.email ?? "")}&next=/dashboard`);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const loginButton = (label: string) => (
    <Button asChild variant="outline" className={authControlClass}>
      <Link href={`/login?next=/invite/${token}`}>{label}</Link>
    </Button>
  );
  const home = (
    <Link href="/" className={authLinkClass}>
      Go to the CampaignGround home page
    </Link>
  );

  if (loadError?.kind === "missing") {
    return (
      <AuthShell title="Invite not found" footer={home}>
        <p className="text-sm text-muted-foreground">
          This link doesn&apos;t match any invite. Check that you copied the whole link from the email. {ASK_OWNER}
        </p>
      </AuthShell>
    );
  }

  if (loadError) {
    return (
      <AuthShell title="Couldn't load your invite">
        <p role="alert" className="text-sm text-muted-foreground">{loadError.message}</p>
        <Button className={authControlClass} onClick={load}>Try again</Button>
      </AuthShell>
    );
  }

  // Wait for the session too, so a signed-in user doesn't see the new-account form flash.
  if (!invite || sessionStatus === "loading") {
    return (
      <AuthShell title="Loading your invite…">
        <p role="status" className="text-sm text-muted-foreground">Checking the invite link.</p>
      </AuthShell>
    );
  }

  const race = `${invite.campaignName}'s campaign for ${invite.officeSought}`;

  if (invite.status !== "pending") {
    const title = invite.status === "accepted" ? "Already accepted" : invite.status === "expired" ? "Invite expired" : "Invite no longer valid";
    return (
      <AuthShell title={title} footer={home}>
        <p className="text-sm text-muted-foreground">
          {invite.status === "accepted"
            ? `This invite to ${race} has already been used. Log in with ${invite.email} to get to the campaign.`
            : `This invite to ${race} can't be used anymore. ${ASK_OWNER}`}
        </p>
        {invite.status === "accepted" && loginButton("Log in")}
      </AuthShell>
    );
  }

  const intro = `You've been invited to join ${race} as a team member: you'll be able to knock doors, make calls, and track tasks.`;

  if (needsLogin) {
    return (
      <AuthShell title="Log in to accept" description={intro}>
        <p className="text-sm text-muted-foreground">
          You already have an account for {invite.email}. Log in and you&apos;ll come straight back here to accept.
        </p>
        {loginButton("Log in to accept")}
      </AuthShell>
    );
  }

  const formAlert = formError && <p role="alert" className="text-sm text-destructive">{formError}</p>;

  if (sessionStatus === "authenticated" && session?.user?.email === invite.email) {
    return (
      <AuthShell title={`Join ${invite.campaignName}`} description={intro}>
        <p className="text-sm text-muted-foreground">You&apos;re signed in as {session.user.email}.</p>
        {formAlert}
        <Button onClick={acceptLoggedIn} className={authControlClass} disabled={submitting}>
          {submitting ? "Joining…" : "Accept invite"}
        </Button>
      </AuthShell>
    );
  }

  const signedInAsDifferentUser =
    sessionStatus === "authenticated" && session?.user?.email && session.user.email !== invite.email;

  return (
    <AuthShell title={`Join ${invite.campaignName}`} description={intro}>
      {signedInAsDifferentUser && (
        <p className="text-sm text-muted-foreground">
          You&apos;re signed in as {session!.user!.email}, but this invite is for {invite.email}. Create an account for{" "}
          {invite.email} below.
        </p>
      )}
      <form onSubmit={acceptNewAccount} className="flex flex-col gap-4">
        {/* Shown read-only so password managers save the new password under the right account. */}
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          value={invite.email}
          readOnly
          hint="The invite is for this address."
          className="bg-muted text-muted-foreground"
        />
        <AuthField
          id="name"
          label="Your name"
          autoComplete="name"
          error={fieldErrors.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          hint={PASSWORD_RULE}
          error={fieldErrors.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {formAlert}
        <Button type="submit" className={authControlClass} disabled={submitting}>
          {submitting ? "Joining…" : "Create account and join"}
        </Button>
      </form>
    </AuthShell>
  );
}
