import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface Claim {
  voterId: string;
  channel: string;
  volunteerId: string;
  volunteerName: string | null;
  claimedAt: string;
}

// Renewal must comfortably beat the server's 5 minute stale cutoff.
const HEARTBEAT_MS = 60_000;

/**
 * Shared claim/release mechanics for the "who's working this contact right
 * now" pattern used by canvassing and phone banking. Owns the claims query,
 * the claimedByOthers Map, and the lifetime of the one claim this tab holds:
 * it is renewed every minute while held and released on release(), on
 * unmount, and when the page is hidden/closed. Callers own when to claim and
 * release.
 */
export function useClaims(channel: string, campaignId: string | null, activeVolunteerId: string) {
  const qc = useQueryClient();
  const [held, setHeld] = useState<{ voterId: string; volunteerId: string } | null>(null);
  // The claim the caller most recently asked for. A claim that comes back after
  // the caller has moved on (released it or asked for another) is let go at once,
  // so fast skipping can't leave voters held and hidden from other volunteers.
  const wanted = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ["claims", channel, campaignId],
    queryFn: async (): Promise<{ items: Claim[] }> =>
      (await fetch(`/api/claims?channel=${channel}&campaignId=${campaignId}`)).json(),
    enabled: !!campaignId,
    refetchInterval: 5_000,
  });
  const claims = data?.items ?? [];

  const claimedByOthers = new Map(
    claims
      .filter((c) => c.volunteerId !== activeVolunteerId)
      .map((c) => [c.voterId, c.volunteerName ?? "another volunteer"])
  );

  const claimMutation = useMutation({
    mutationFn: async ({ voterId, volunteerId }: { voterId: string; volunteerId: string }) =>
      fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId, channel, volunteerId }),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["claims", channel] }),
  });

  useEffect(() => {
    if (!held) return;
    const send = (method: "POST" | "DELETE") =>
      fetch("/api/claims", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...held, channel }),
        // keepalive lets the release survive the page being closed.
        keepalive: true,
      });
    const timer = setInterval(() => send("POST"), HEARTBEAT_MS);
    const onPageHide = () => send("DELETE");
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", onPageHide);
      send("DELETE").finally(() => qc.invalidateQueries({ queryKey: ["claims", channel] }));
    };
  }, [held, channel, qc]);

  return {
    claims,
    claimedByOthers,
    claim: async (voterId: string, volunteerId: string) => {
      const key = `${voterId}:${volunteerId}`;
      wanted.current = key;
      const r = await claimMutation.mutateAsync({ voterId, volunteerId });
      if (r.ok && wanted.current !== key) {
        fetch("/api/claims", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voterId, volunteerId, channel }),
          keepalive: true,
        }).finally(() => qc.invalidateQueries({ queryKey: ["claims", channel] }));
      } else if (r.ok) {
        // Keep the same object when re-claiming what we already hold so the
        // heartbeat effect doesn't release and lose it.
        setHeld((prev) =>
          prev?.voterId === voterId && prev.volunteerId === volunteerId ? prev : { voterId, volunteerId }
        );
      }
      return r;
    },
    // Releasing happens in the heartbeat effect's cleanup.
    release: (voterId: string, volunteerId: string) => {
      if (wanted.current === `${voterId}:${volunteerId}`) wanted.current = null;
      setHeld((prev) => (prev?.voterId === voterId && prev.volunteerId === volunteerId ? null : prev));
    },
  };
}
