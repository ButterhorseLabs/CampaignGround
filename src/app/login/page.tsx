"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthShell, authLinkClass } from "@/components/auth/auth-shell";
import { AuthField, authControlClass } from "@/components/auth/auth-field";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

type LoginError = "wrong" | "locked" | "offline";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `next` comes from our own links; `callbackUrl` from the auth middleware, as an absolute URL.
  const returnTo = searchParams.get("next") ?? searchParams.get("callbackUrl");
  const created = searchParams.get("created") === "1";
  const reset = searchParams.get("reset") === "1";
  const prefilled = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(prefilled);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<LoginError | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false }).catch(() => null);
    setLoading(false);
    if (!result) {
      setError("offline");
      return;
    }
    if (result.error) {
      // lib/auth.ts throws "RateLimited" when the login is locked out.
      setError(result.error === "RateLimited" ? "locked" : "wrong");
      return;
    }
    router.push(sameOriginPath(returnTo) ?? "/dashboard");
    router.refresh();
  }

  const wrong = error === "wrong";

  return (
    <AuthShell
      title="Log in"
      description="Welcome back. Log in to manage your campaign."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className={authLinkClass}>
            Start your campaign
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {(created || reset) && (
          <p role="status" className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            {created ? "Your account was created. Log in to continue." : "Password updated. Log in with your new password."}
          </p>
        )}
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          aria-invalid={wrong || undefined}
          aria-describedby={error ? "login-error" : undefined}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          // After signup or a reset the email is already filled in.
          autoFocus={!!prefilled}
          aria-invalid={wrong || undefined}
          aria-describedby={error ? "login-error" : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {error === "locked" && "Too many attempts. Wait 15 minutes, then try again."}
            {error === "offline" && "No connection. Try again when you're back online."}
            {wrong && (
              <>
                Email or password is incorrect.{" "}
                <Link href="/forgot-password" className="underline underline-offset-2">
                  Reset your password
                </Link>
              </>
            )}
          </p>
        ) : (
          <Link href="/forgot-password" className={`${authLinkClass} self-start text-sm`}>
            Forgot your password?
          </Link>
        )}
        <Button type="submit" className={authControlClass} disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}

/** Follows a return address only when it stays on this site ("//evil.example" and other origins are ignored). */
function sameOriginPath(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search : null;
  } catch {
    return null;
  }
}
