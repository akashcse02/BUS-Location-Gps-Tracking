import { createServerFn } from "@tanstack/react-start";

// These two run as TanStack Start *server* functions — there's no browser
// localStorage here, so (unlike the rest of the app) they can't go through
// the db-shim's automatic token pickup. The driver's token is passed
// in explicitly from the client (see driver-dashboard.tsx) and forwarded to
// our backend's generic /db/trips endpoint directly.

function apiBase(): string {
  return process.env['API_URL'] || process.env['VITE_API_URL'] || "http://localhost:5000/api";
}

async function updateTrip(tripId: string, token: string, values: Record<string, unknown>) {
  const res = await fetch(`${apiBase()}/db/trips`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action: "update", filters: [["id", "eq", tripId]], values }),
  });
  const json = await res.json().catch(() => ({}));
  return json;
}

export const updateBusLocation = createServerFn({ method: "POST" })
  .validator((data: { tripId: string; lat: number; lng: number; token: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await updateTrip(data.tripId, data.token, {
      current_lat: data.lat,
      current_lng: data.lng,
    });
    if (error) throw new Error(error.message || "Failed to update location");
    return { success: true };
  });

export const updateOccupancy = createServerFn({ method: "POST" })
  .validator((data: { tripId: string; occupancy: "low" | "medium" | "high"; token: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await updateTrip(data.tripId, data.token, { occupancy: data.occupancy });
    if (error) throw new Error(error.message || "Failed to update occupancy");
    return { success: true };
  });
