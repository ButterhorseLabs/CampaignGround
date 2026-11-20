"use client";

import { useApp, type Module } from "@/lib/store";
import { useCurrentMembership } from "@/lib/memberships";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  HeartHandshake,
  DollarSign,
  DoorOpen,
  PhoneCall,
  CalendarDays,
  ListTodo,
  Vote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  id: Module;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  ownerOnly?: boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Live metrics" },
    ],
  },
  {
    section: "People",
    items: [
      { id: "voters", label: "Voters", icon: Users },
      { id: "volunteers", label: "Volunteers", icon: HeartHandshake },
      { id: "donors", label: "Donors", icon: DollarSign, ownerOnly: true },
    ],
  },
  {
    section: "Outreach",
    items: [
      { id: "canvass", label: "Canvassing", icon: DoorOpen, hint: "Walk lists" },
      { id: "phonebank", label: "Phone Bank", icon: PhoneCall },
    ],
  },
  {
    section: "Plan",
    items: [
      { id: "events", label: "Events", icon: CalendarDays },
      { id: "tasks", label: "Tasks", icon: ListTodo },
    ],
  },
];

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

export function BrandLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-sm">
        <Vote className="size-5" aria-hidden />
      </div>
      <div className="leading-tight text-left">
        <div className="font-semibold text-[15px] text-sidebar-foreground">CampaignGround</div>
        <div className="text-[11px] text-muted-foreground tracking-wide uppercase">
          Local Election CRM
        </div>
      </div>
    </div>
  );
}

/** Grouped module navigation, shared by the desktop sidebar and the mobile sheet. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const active = useApp((s) => s.active);
  const setModule = useApp((s) => s.set);
  const role = useCurrentMembership()?.role ?? null;

  return (
    <nav aria-label="Modules" className="px-3 py-4">
      {NAV.map((group) => (
        <div key={group.section} className="mb-5 last:mb-0">
          <div className="px-2 mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            {group.section}
          </div>
          <ul className="space-y-0.5">
            {group.items.filter((item) => !item.ownerOnly || role === "owner").map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => {
                      setModule(item.id);
                      onNavigate?.();
                    }}
                    className={cn(
                      "w-full group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn("size-4", isActive ? "" : "text-muted-foreground group-hover:text-sidebar-accent-foreground")}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.hint && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full border",
                        isActive
                          ? "border-sidebar-primary-foreground/30 text-sidebar-primary-foreground/80"
                          : "border-border text-muted-foreground"
                      )}>
                        {item.hint}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function electionCountdown(electionDate: string): string {
  const days = Math.ceil((new Date(electionDate).getTime() - Date.now()) / 86_400_000);
  if (days > 1) return `Election in ${days} days`;
  if (days === 1) return "Election tomorrow";
  if (days === 0) return "Election day";
  return "Election has passed";
}

export function SidebarFooter() {
  const membership = useCurrentMembership();

  return (
    <div className="px-4 py-3 border-t border-sidebar-border text-[11px] text-muted-foreground">
      <div className="flex items-center justify-between gap-2 min-h-4">
        <span className="truncate tabular-nums">
          {membership ? electionCountdown(membership.electionDate) : null}
        </span>
        {APP_VERSION && (
          <Badge variant="outline" className="font-mono text-[10px] py-0 h-4">
            v{APP_VERSION}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center px-5 h-16 border-b border-sidebar-border">
        <BrandLockup />
      </div>

      <div className="flex-1 overflow-y-auto scroll-area-thin">
        <SidebarNav />
      </div>

      <SidebarFooter />
    </aside>
  );
}
