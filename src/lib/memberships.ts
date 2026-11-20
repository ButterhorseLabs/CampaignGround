import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/lib/store";

export interface Membership {
  campaignId: string;
  campaignName: string;
  officeSought: string;
  /** ISO timestamp */
  electionDate: string;
  role: "owner" | "member";
}

export function useMemberships() {
  return useQuery({
    queryKey: ["memberships"],
    queryFn: async (): Promise<{ items: Membership[]; isPlatformOwner: boolean }> => {
      const r = await fetch("/api/memberships");
      // A failed request is an error, not "no campaigns and not the platform owner".
      if (!r.ok) throw new Error(`/api/memberships returned ${r.status}`);
      return r.json();
    },
  });
}

export function useCurrentMembership(): Membership | null {
  const currentCampaignId = useApp((s) => s.currentCampaignId);
  const { data } = useMemberships();
  return data?.items.find((m) => m.campaignId === currentCampaignId) ?? null;
}

export function useCurrentRole(): "owner" | "member" | null {
  return useCurrentMembership()?.role ?? null;
}

export function useIsPlatformOwner(): boolean {
  const { data } = useMemberships();
  return data?.isPlatformOwner ?? false;
}
