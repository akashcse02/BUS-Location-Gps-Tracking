import { useEffect, useState } from "react";
import { trackingLive } from "@/integrations/backend/client";
import type { LivePositions } from "@/lib/bus-fleet";

/** "Bus 01" | "01" | "PUB-01" -> "bus-01" so live GPS maps onto our fleet list. */
export function fleetIdFromBusNumber(busNumber: string | null | undefined): string | null {
  if (!busNumber) return null;
  const match = busNumber.match(/(\d{1,2})\s*$/);
  if (!match) return null;
  return `bus-${match[1]!.padStart(2, "0")}`;
}

/**
 * Live GPS feed. Empty until a driver starts a trip and broadcasts coordinates;
 * markers then switch from their default campus position automatically.
 */
export function useLiveBusPositions() {
  const [positions, setPositions] = useState<LivePositions>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await trackingLive();
      if (cancelled || !result.res.ok || !Array.isArray(result.json?.data)) return;
      const next: LivePositions = {};
      for (const trip of result.json.data as Array<Record<string, any>>) {
        const id = fleetIdFromBusNumber(trip.bus_number);
        const lat = trip.current_lat;
        const lng = trip.current_lng;
        if (id && typeof lat === "number" && typeof lng === "number") {
          next[id] = { lat, lng, updatedAt: trip.last_gps_at || trip.updated_at };
        }
      }
      setPositions(next);
    };

    void load();

    const interval = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return positions;
}
