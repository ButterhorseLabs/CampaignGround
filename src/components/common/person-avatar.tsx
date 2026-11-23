"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

/**
 * Initials in a neutral circle, to anchor a person card or header. Decorative:
 * the name is always shown beside it, so it's hidden from screen readers. Never
 * colored: on this app color means support level or status (DESIGN.md).
 */
export function PersonAvatar({ first, last, className }: { first?: string; last?: string; className?: string }) {
  return (
    <Avatar aria-hidden className={cn("size-12 bg-muted text-base font-medium text-muted-foreground", className)}>
      <AvatarFallback className="bg-transparent">{initials(first, last)}</AvatarFallback>
    </Avatar>
  );
}
