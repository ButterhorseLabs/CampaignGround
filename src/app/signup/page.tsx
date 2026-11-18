"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthShell } from "@/components/auth/auth-shell";
import { PASSWORD_RULE } from "@/lib/validation/signup";

const SELF_HOST_URL = "https://github.com/ButterhorseLabs/CampaignGround#deploying-to-railway";

type FieldErrors = Record<string, string>;

// Label + input + optional hint/error, with aria wiring so screen readers
// hear the rule and any server-reported problem for this exact field.
function Field({
  id,
  label,
  hint,
  error,
  ...input
}: { id: string; label: string; hint?: string; error?: string } & React.ComponentProps<typeof Input>) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();

  const [open, setOpen] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [officeSought, setOfficeSought] = useState("");
  const [district, setDistrict] = useState("");
  const [party, setParty] = useState("");
  const [electionDate, setElectionDate] = useState("");
  const [voteGoal, setVoteGoal] = useState("");
  const [fundraisingGoal, setFundraisingGoal] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/signup")
      .then((r) => (r.ok ? r.json() : { open: true }))
      .then((b: { open: boolean }) => setOpen(b.open))
      // Unknown capacity: show the form; POST still enforces the limit.
      .catch(() => setOpen(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const r = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        candidateName,
        officeSought,
        district,
        party: party || undefined,
        electionDate,
        voteGoal: voteGoal ? parseInt(voteGoal, 10) : undefined,
        fundraisingGoalCents: fundraisingGoal
          ? Math.round(parseFloat(fundraisingGoal) * 100)
          : undefined,
      }),
    });

    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      const issues: { path: string; message: string }[] = Array.isArray(body?.issues) ? body.issues : [];
      if (issues.length > 0) {
        const map: FieldErrors = {};
        for (const i of issues) map[i.path === "fundraisingGoalCents" ? "fundraisingGoal" : i.path] ??= i.message;
        setFieldErrors(map);
        setError("Some fields need attention. Fix the highlighted fields and try again.");
      } else {
        if (r.status === 403) setOpen(false);
        setError(body?.error ?? "Something went wrong. Please try again.");
      }
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      router.push(`/login?created=1&email=${encodeURIComponent(email)}`);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const loginFooter = (
    <CardFooter>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline underline-offset-2">
          Log in
        </Link>
      </p>
    </CardFooter>
  );

  if (open === false) {
    return (
      <AuthShell>
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Start your campaign</CardTitle>
          </CardHeader>
          <CardContent>
            <p role="status" className="text-sm">
              New signups are closed on this server. Ask the person who runs it for an invite, or{" "}
              <a href={SELF_HOST_URL} className="text-primary underline underline-offset-2">
                run your own copy
              </a>
              .
            </p>
          </CardContent>
          {loginFooter}
        </Card>
      </AuthShell>
    );
  }

  const fe = fieldErrors;

  return (
    <AuthShell>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Start your campaign</CardTitle>
          <CardDescription>
            Create your account and your campaign. Free to use, with no credit
            card. You can invite your team once you&apos;re set up.
          </CardDescription>
          <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            Joining a team? Use the link in your invite email instead.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field id="name" label="Your name" error={fe.name} value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                error={fe.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Field
                id="password"
                label="Password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                hint={PASSWORD_RULE}
                error={fe.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="border-t pt-4 flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">Campaign details</p>
              <Field
                id="candidateName"
                label="Candidate name"
                error={fe.candidateName}
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  id="officeSought"
                  label="Office sought"
                  error={fe.officeSought}
                  value={officeSought}
                  onChange={(e) => setOfficeSought(e.target.value)}
                  required
                />
                <Field id="district" label="District" error={fe.district} value={district} onChange={(e) => setDistrict(e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="party" label="Party (optional)" error={fe.party} value={party} onChange={(e) => setParty(e.target.value)} />
                <Field
                  id="electionDate"
                  label="Election date"
                  type="date"
                  error={fe.electionDate}
                  value={electionDate}
                  onChange={(e) => setElectionDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                  id="voteGoal"
                  label="Vote goal (optional)"
                  type="number"
                  error={fe.voteGoal}
                  value={voteGoal}
                  onChange={(e) => setVoteGoal(e.target.value)}
                />
                <Field
                  id="fundraisingGoal"
                  label="Fundraising goal, USD (optional)"
                  type="number"
                  error={fe.fundraisingGoal}
                  value={fundraisingGoal}
                  onChange={(e) => setFundraisingGoal(e.target.value)}
                />
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading || open === null}>
              {loading ? "Creating your campaign…" : "Create account"}
            </Button>
          </form>
        </CardContent>
        {loginFooter}
      </Card>
    </AuthShell>
  );
}
