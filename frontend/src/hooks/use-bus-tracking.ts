import { useEffect, useState } from "react";
import { db } from "@/integrations/backend/client";
import { Database } from "@/integrations/backend/types";

type Trip = Database["public"]["Tables"]["trips"]["Row"];

export function useBusTracking(busId?: string) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!busId) return;

    const fetchTrip = async () => {
      const { data, error } = await db
        .from("trips")
        .select("*")
        .eq("bus_id", busId)
        .eq("status", "in_progress")
        .maybeSingle();

      if (!error && data) {
        setTrip(data);
      }
      setIsLoading(false);
    };

    fetchTrip();

    // Polling stand-in for realtime updates (see client.ts) — re-fetches
    // this bus's in-progress trip every few seconds instead of pushing
    // row-level UPDATE events.
    const channel = db
      .channel(`bus-${busId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trips",
          filter: `bus_id=eq.${busId}`,
        },
        () => {
          void fetchTrip();
        }
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [busId]);

  return { trip, isLoading };
}
