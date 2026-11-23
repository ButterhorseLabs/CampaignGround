"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import { AuthField, authControlClass, focusFirstInvalid } from "@/components/auth/auth-field";
import { PASSWORD_RULE, electionDateBounds } from "@/lib/validation/signup";
import { PARTIES } from "@/lib/types";

const SELF_HOST_URL = "https://github.com/ButterhorseLabs/CampaignGround#deploying-to-railway";
const NONPARTISAN = "nonpartisan";
// "No party" describes a voter's registration, not a race.
const CANDIDATE_PARTIES = PARTIES.filter((p) => p.value !== "NPP");

type FieldErrors = Record<string, string>;

export default function SignupPage() {
  const router = useRouter();

  const [open, setOpen] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Follows "Your name" until edited: most people signing up are the candidate.
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [officeSought, setOfficeSought] = useState("");
  const [district, setDistrict] = useState("");
  const [party, setParty] = useState(NONPARTISAN);
  const [electionDate, setElectionDate] = useState("");

  const [error, setError] = useState<React.ReactNode>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const dates = electionDateBounds();
  const candidate = candidateName ?? name;

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

    let r: Response;
    try {
      r = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          candidateName: candidate,
          officeSought,
          district,
          party: party === NONPARTISAN ? undefined : party,
          electionDate,
        }),
      });
    } catch {
      setError("No connection. Your details are still here; try again when you're back online.");
      setLoading(false);
      return;
    }

    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      const issues: { path: string; message: string }[] = Array.isArray(body?.issues) ? body.issues : [];
      if (issues.length > 0) {
        const map: FieldErrors = {};
        for (const i of issues) map[i.path] ??= i.message;
        setFieldErrors(map);
        setError("Some fields need attention. Fix the highlighted fields and try again.");
        focusFirstInvalid();
      } else if (r.status === 409) {
        setFieldErrors({ email: "An account with this email already exists." });
        setError(
          <>
            You already have an account.{" "}
            <Link href={`/login?email=${encodeURIComponent(email)}`} className="underline underline-offset-2">Log in</Link> or{" "}
            <Link href="/forgot-password" className="underline underline-offset-2">reset your password</Link>.
          </>
        );
        focusFirstInvalid();
      } else {
        if (r.status === 403) setOpen(false);
        setError(body?.error ?? "Something went wrong on our end. Try again in a minute.");
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
    <>
      Already have an account?{" "}
      <Link href="/login" className={authLinkClass}>
        Log in
      </Link>
    </>
  );

  if (open === false) {
    return (
      <AuthShell title="Start your campaign" footer={loginFooter} wide>
        <p role="status" className="text-sm">
          New signups are closed on this server. Ask the person who runs it for an invite, or{" "}
          <a href={SELF_HOST_URL} className="text-primary underline underline-offset-2">
            run your own copy
          </a>
          .
        </p>
      </AuthShell>
    );
  }

  const fe = fieldErrors;

  return (
    <AuthShell
      title="Start your campaign"
      description="Create your account and your campaign. Free to use, with no credit card. You can invite your team once you're set up."
      footer={loginFooter}
      wide
    >
      <p className="text-sm text-muted-foreground">Joining a team? Use the link in your invite email instead.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField id="name" label="Your name" autoComplete="name" error={fe.name} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            error={fe.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <AuthField
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

        <fieldset className="flex flex-col gap-3 border-t pt-4">
          <legend className="float-left mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Campaign details
          </legend>
          <AuthField
            id="candidateName"
            label="Candidate name"
            hint="Change this if you're running someone else's campaign."
            error={fe.candidateName}
            value={candidate}
            onChange={(e) => setCandidateName(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AuthField
              id="officeSought"
              label="Office sought"
              placeholder="City Council"
              error={fe.officeSought}
              value={officeSought}
              onChange={(e) => setOfficeSought(e.target.value)}
              required
            />
            <AuthField
              id="district"
              label="District"
              placeholder="Ward 3"
              error={fe.district}
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="party">Party</Label>
              <Select value={party} onValueChange={setParty}>
                <SelectTrigger
                  id="party"
                  aria-invalid={fe.party ? true : undefined}
                  className="w-full data-[size=default]:h-11 md:data-[size=default]:h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONPARTISAN}>Nonpartisan race</SelectItem>
                  {CANDIDATE_PARTIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fe.party && <p className="text-xs text-destructive">{fe.party}</p>}
            </div>
            <AuthField
              id="electionDate"
              label="Election date"
              type="date"
              min={dates.min}
              max={dates.max}
              error={fe.electionDate}
              value={electionDate}
              onChange={(e) => setElectionDate(e.target.value)}
              required
            />
          </div>
        </fieldset>

        <p className="text-xs text-muted-foreground">
          Only your team can see your voters and volunteers, and only campaign owners see donors. Whoever runs this
          server can see your campaign&apos;s name and who&apos;s on your team, not its records.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className={authControlClass} disabled={loading || open === null}>
          {loading ? "Creating your campaign…" : "Create campaign"}
        </Button>
      </form>
    </AuthShell>
  );
}
