"use client";

import { useEffect } from "react";
import { useApp, type Module } from "@/lib/store";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { VotersView } from "@/components/voters/voters-view";
import { VolunteersView } from "@/components/volunteers/volunteers-view";
import { DonorsView } from "@/components/donors/donors-view";
import { CanvassView } from "@/components/canvass/canvass-view";
import { PhoneBankView } from "@/components/phonebank/phonebank-view";
import { EventsView } from "@/components/events/events-view";
import { TasksView } from "@/components/tasks/tasks-view";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const MODULES: Module[] = ["dashboard", "voters", "volunteers", "donors", "canvass", "phonebank", "events", "tasks"];

/** Keeps the open module in `?view=` so refresh, Back, and shared links return to it. */
function useModuleInUrl() {
  const active = useApp((s) => s.active);
  const setActive = useApp((s) => s.set);

  useEffect(() => {
    const fromUrl = () => {
      const view = new URLSearchParams(window.location.search).get("view");
      setActive(MODULES.find((m) => m === view) ?? "dashboard");
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    return () => window.removeEventListener("popstate", fromUrl);
  }, [setActive]);

  useEffect(() => {
    // Read the store, not the render value: on first load the URL sync above has just updated it.
    const current = useApp.getState().active;
    const url = current === "dashboard" ? "/dashboard" : `/dashboard?view=${current}`;
    if (window.location.pathname + window.location.search !== url) window.history.pushState(null, "", url);
  }, [active]);
}

function Shell() {
  const active = useApp((s) => s.active);
  useModuleInUrl();
  const currentCampaignId = useApp((s) => s.currentCampaignId);
  const setCampaign = useApp((s) => s.setCampaign);

  // Scroll to top on module change
  useEffect(() => {
    const main = document.getElementById("main-scroll");
    if (main) main.scrollTo({ top: 0, behavior: "smooth" });
  }, [active]);

  // Resolve a default campaign on first load if none is selected/persisted yet.
  useEffect(() => {
    if (currentCampaignId) return;
    let cancelled = false;
    fetch("/api/memberships").then(async (r) => {
      if (cancelled) return;
      const data = await r.json();
      if (data.items?.[0]) setCampaign(data.items[0].campaignId);
    });
    return () => {
      cancelled = true;
    };
  }, [currentCampaignId, setCampaign]);

  if (!currentCampaignId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading your campaigns…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a
        href="#main-scroll"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-[3px] focus:ring-ring/50"
      >
        Skip to content
      </a>
      <Sidebar />
      <MobileNav />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main id="main-scroll" tabIndex={-1} className="flex-1 overflow-y-auto scroll-area-thin outline-none">
          {active === "dashboard" && <DashboardView />}
          {active === "voters" && <VotersView />}
          {active === "volunteers" && <VolunteersView />}
          {active === "donors" && <DonorsView />}
          {active === "canvass" && <CanvassView />}
          {active === "phonebank" && <PhoneBankView />}
          {active === "events" && <EventsView />}
          {active === "tasks" && <TasksView />}
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}
