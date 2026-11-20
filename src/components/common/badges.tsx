"use client";

import { cn } from "@/lib/utils";
import { SUPPORT_LEVELS, partyLabel, type SupportLevel } from "@/lib/types";

interface Props {
  level: SupportLevel | string | null | undefined;
  className?: string;
  size?: "sm" | "md";
}

const COLOR_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
  lime: "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-950/40 dark:text-lime-300 dark:border-lime-900",
  amber: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
  orange: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900",
  red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900",
  slate: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800",
};

const DOT_CLASSES: Record<string, string> = {
  emerald: "bg-emerald-500",
  lime: "bg-lime-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  slate: "bg-slate-400",
};

function supportConfig(level: Props["level"]) {
  return SUPPORT_LEVELS.find((s) => s.value === level) ?? SUPPORT_LEVELS.find((s) => s.value === "unknown")!;
}

/** Tinted fill, text, and border for a support level, from the status ramp. */
export const supportTone = (level: Props["level"]) => COLOR_CLASSES[supportConfig(level).color];

export function SupportBadge({ level, className, size = "sm" }: Props) {
  const config = supportConfig(level);
  const color = config.color;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        COLOR_CLASSES[color],
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT_CLASSES[color])} aria-hidden />
      {config.label}
    </span>
  );
}

/** Party is shown, never colored: one neutral chip for every party (DESIGN.md, Nonpartisan Palette Rule). */
export function PartyBadge({ party, className }: { party?: string | null; className?: string }) {
  if (!party) return null;
  return (
    <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground whitespace-nowrap", className)}>
      {partyLabel(party)}
    </span>
  );
}
