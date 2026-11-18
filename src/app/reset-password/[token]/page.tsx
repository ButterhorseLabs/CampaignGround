"use client";

import { use, useState } from "react";
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

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The passwords don't match. Type the same password in both fields.");
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
      setError(
        body?.issues?.[0]?.message ??
          (r?.status === 400 ? body?.error : null) ??
          "Couldn't update your password. Try again in a minute."
      );
      return;
    }
    setDone(true);
  }

  const expired = error?.startsWith("This reset link");

  return (
    <AuthShell>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          {!done && <CardDescription>Pick a password you don&apos;t use anywhere else.</CardDescription>}
        </CardHeader>
        <CardContent>
          {done ? (
            <p role="status" className="text-sm">
              Your password was updated.{" "}
              <Link href="/login?reset=1" className="text-primary underline underline-offset-2">
                Log in
              </Link>
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  aria-describedby="password-hint"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p id="password-hint" className="text-xs text-muted-foreground">{PASSWORD_RULE}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                  {expired && (
                    <>
                      {" "}
                      <Link href="/forgot-password" className="underline underline-offset-2">
                        Request a new link
                      </Link>
                    </>
                  )}
                </p>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
        {!done && (
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-primary underline underline-offset-2">
                Back to log in
              </Link>
            </p>
          </CardFooter>
        )}
      </Card>
    </AuthShell>
  );
}
