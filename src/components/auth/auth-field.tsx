"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Inputs on auth pages meet the 44px phone target (DESIGN.md). */
export const authControlClass = "h-11 md:h-9";

/**
 * Label + input + optional hint and error, wired so screen readers hear the
 * rule and any problem with this exact field. Password fields get a show/hide
 * button, since 12+ characters on a phone keyboard are easy to mistype.
 * While an error shows, it replaces the hint rather than repeating it.
 */
export function AuthField({ id, label, hint, error, after, className, type, ...input }: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Rendered beside the label, e.g. a "Forgot your password?" link. */
  after?: React.ReactNode;
} & React.ComponentProps<typeof Input>) {
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  const note = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {after}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && shown ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? `${id}-note` : undefined}
          className={cn(authControlClass, isPassword && "pr-12", className)}
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            aria-controls={id}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        )}
      </div>
      {note && (
        <p id={`${id}-note`} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {note}
        </p>
      )}
    </div>
  );
}

/** Moves focus to the first field the server flagged, so keyboard and screen-reader users land on it. */
export function focusFirstInvalid() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
}
