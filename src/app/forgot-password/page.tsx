"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import { AuthField, authControlClass } from "@/components/auth/auth-field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch("/api/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setLoading(false);
    if (!r?.ok) {
      const body = await r?.json().catch(() => ({}));
      setError(
        !r
          ? "No connection. Try again when you're back online."
          : r.status === 400
            ? (body?.issues?.[0]?.message ?? "Enter an email like name@example.com.")
            : (body?.error ?? "Couldn't send the reset link. Try again in a minute.")
      );
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your account email and we'll send you a link to choose a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className={authLinkClass}>
            Log in
          </Link>
        </>
      }
    >
      {sent ? (
        <p role="status" className="text-sm">
          If an account exists for that email, we sent a reset link. It expires in 1 hour.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className={authControlClass} disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
