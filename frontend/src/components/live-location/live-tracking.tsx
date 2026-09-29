import { useEffect, useState, type ReactNode } from "react";
import { Bus, CircleCheck, MapPin, Radio } from "lucide-react";
import { GoogleLiveMap } from "@/components/maps/google-live-map";
import { db, trackingLive } from "@/integrations/backend/client";

export function LiveTracking() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [liveRows, setLiveRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: routeData }, live] = await Promise.all([
        db.from("routes").select("*") as any,
        trackingLive(),
      ]);
      if (cancelled) return;
      setRoutes(Array.isArray(routeData) ? routeData : []);
      setLiveRows(live.res.ok && Array.isArray(live.json?.data) ? live.json.data : []);
    };
    void load();
    const timer = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const liveCount = liveRows.filter((row) => row.trip_status === "in_progress" || row.trip_status === "delayed").length;
  const gpsCount = liveRows.filter((row) => typeof row.current_lat === "number" && typeof row.current_lng === "number").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<Bus className="h-4 w-4" />} label="Buses" value={liveRows.length} />
        <Stat icon={<CircleCheck className="h-4 w-4" />} label="Active trips" value={liveCount} />
        <Stat icon={<Radio className="h-4 w-4" />} label="GPS connected" value={gpsCount} />
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/85 p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink/60">
          <MapPin className="h-4 w-4 text-primary" />
          {routes.length} routes loaded from MongoDB. Changes made by Admin appear automatically.
        </div>
        <div className="flex flex-wrap gap-2">
          {routes.map((route, index) => (
            <span key={route.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">
              {route.name || `Route ${index + 1}`} · {(route.stops || []).length} stops
            </span>
          ))}
        </div>
      </div>

      <div className="h-[70vh] min-h-[520px] overflow-hidden rounded-[1.75rem] border border-white/70 shadow-xl">
        <GoogleLiveMap />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">{label}</p>
        <p className="text-xl font-black text-ink">{value}</p>
      </div>
    </div>
  );
}
