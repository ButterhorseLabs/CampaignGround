"use client";

import { cn } from "@/lib/utils";

interface Props {
  raised: number; // cents
  goal: number;   // cents
  className?: string;
  showLabel?: boolean;
}

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

export function FundraisingBar({ raised, goal, className, showLabel = true }: Props) {
  const pct = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div
        role="progressbar"
        aria-label="Raised toward fundraising goal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-2.5 rounded-full bg-secondary overflow-hidden"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{pct.toFixed(1)}%</span>
          <span>
            <span className="font-semibold text-foreground">{usd(raised)}</span> of {usd(goal)}
          </span>
        </div>
      )}
    </div>
  );
}
