"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import { AuthField, authControlClass } from "@/components/auth/auth-field";
import { PASSWORD_RULE } from "@/lib/validation/signup";

const MISMATCH = "The passwords don't match. Type the same password in both fields.";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  // null while checking; checked up front so nobody types two passwords into a dead link.
  const [valid, setValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/password-reset/confirm?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : { valid: true }))
      .then((b: { valid: boolean }) => setValid(b.valid))
      // Can't tell: show the form; the submit still checks the link.
      .catch(() => setValid(true));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(MISMATCH);
      return;
    }
    setLoading(true);
    setError(null);
    const r = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);
    setLoading(false);
    if (!r?.ok) {
      const body = await r?.json().catch(() => ({}));
      if (body?.expired) {
        setValid(false);
        return;
      }
      setError(
        !r
          ? "No connection. Try again when you're back online."
          : (body?.issues?.[0]?.message ?? body?.error ?? "Couldn't update your password. Try again in a minute.")
      );
      return;
    }
    setDone(true);
  }

  const backToLogin = (
    <Link href="/login" className={authLinkClass}>
      Back to log in
    </Link>
  );

  if (done) {
    return (
      <AuthShell title="Password updated">
        <p role="status" className="text-sm">
          Your password was updated.{" "}
          <Link href="/login?reset=1" className={authLinkClass}>
            Log in
          </Link>
        </p>
      </AuthShell>
    );
  }

  if (valid === false) {
    return (
      <AuthShell title="This link has expired" footer={backToLogin}>
        <p className="text-sm text-muted-foreground">
          Reset links work once and expire after 1 hour. Request a new one and use the newest email.
        </p>
        <Button asChild className={authControlClass}>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" description="Pick a password you don't use anywhere else." footer={backToLogin}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={valid === null}>
        <AuthField
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          hint={PASSWORD_RULE}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <AuthField
          id="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={error === MISMATCH ? MISMATCH : undefined}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {error && error !== MISMATCH && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {error === MISMATCH && <span role="alert" className="sr-only">{MISMATCH}</span>}
        <Button type="submit" className={authControlClass} disabled={loading || valid === null}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
