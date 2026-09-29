import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bus, LocateFixed, Minus, Plus } from "lucide-react";
import { trackingLive } from "@/integrations/backend/client";
import { db } from "@/integrations/backend/client";

interface Location {
  lat: number;
  lng: number;
}

interface BusMarker {
  id: string;
  busNumber: string;
  location: Location;
  occupancy?: "low" | "medium" | "high";
  status?: string;
}

interface RouteRow {
  id: string;
  name: string;
  color?: string;
  stops?: Array<{ name: string; position?: Location; lat?: number; lng?: number }>;
}

interface GoogleLiveMapProps {
  apiKey?: string;
  center?: Location;
  zoom?: number;
  buses?: BusMarker[];
  path?: Location[];
  showTraffic?: boolean;
}

const defaultCenter = { lat: 24.9223067, lng: 89.3490259 };
const TILE_SIZE = 256;
const DEFAULT_ZOOM = 12;
const COLORS = ["#1F72C8", "#E0A03A", "#2E8FDD", "#5B6FD6", "#3E8E5C"];

function worldPixel(position: Location, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((position.lng + 180) / 360) * scale;
  const sin = Math.sin((position.lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function screenPoint(position: Location, center: Location, zoom: number, width: number, height: number) {
  const p = worldPixel(position, zoom);
  const c = worldPixel(center, zoom);
  return { x: width / 2 + p.x - c.x, y: height / 2 + p.y - c.y };
}

function clampLat(lat: number) {
  return Math.max(-85, Math.min(85, lat));
}

export function GoogleLiveMap({ center = defaultCenter, zoom = DEFAULT_ZOOM, buses = [], path = [] }: GoogleLiveMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 900, height: 500 });
  const [mapCenter, setMapCenter] = useState(center);
  const [level, setLevel] = useState(zoom);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [liveRows, setLiveRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<BusMarker | null>(null);

  useEffect(() => {
    setMapCenter(center);
  }, [center.lat, center.lng]);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setSize({ width: node.clientWidth, height: node.clientHeight }));
    observer.observe(node);
    setSize({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: routeData }, live] = await Promise.all([
        db.from("routes").select("*") as any,
        trackingLive(),
      ]);
      if (cancelled) return;
      if (Array.isArray(routeData)) setRoutes(routeData);
      if (live.res.ok && Array.isArray(live.json?.data)) setLiveRows(live.json.data);
    };
    void load();
    const timer = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const liveBuses = useMemo<BusMarker[]>(() => {
    const apiBuses = liveRows
      .filter((row) => typeof row.current_lat === "number" && typeof row.current_lng === "number")
      .map((row) => ({
        id: row.bus_id,
        busNumber: row.bus_number,
        location: { lat: row.current_lat, lng: row.current_lng },
        occupancy: row.occupancy,
        status: row.trip_status === "in_progress" ? "Live" : row.trip_status,
      }));
    if (!buses.length) return apiBuses;
    return buses.map((bus) => apiBuses.find((live) => live.id === bus.id) ? apiBuses.find((live) => live.id === bus.id)! : bus);
  }, [buses, liveRows]);

  const routePaths = useMemo(() => {
    return routes.map((route, index) => ({
      ...route,
      color: route.color || COLORS[index % COLORS.length],
      points: (route.stops || []).map((stop) => stop.position || { lat: Number(stop.lat), lng: Number(stop.lng) }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    }));
  }, [routes]);

  const tiles = useMemo(() => {
    const centerWorld = worldPixel(mapCenter, level);
    const minX = Math.floor((centerWorld.x - size.width / 2) / TILE_SIZE) - 1;
    const maxX = Math.floor((centerWorld.x + size.width / 2) / TILE_SIZE) + 1;
    const minY = Math.floor((centerWorld.y - size.height / 2) / TILE_SIZE) - 1;
    const maxY = Math.floor((centerWorld.y + size.height / 2) / TILE_SIZE) + 1;
    const max = 2 ** level;
    const result: Array<{ x: number; y: number; left: number; top: number; url: string }> = [];
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const wrappedX = ((x % max) + max) % max;
        result.push({
          x,
          y,
          left: size.width / 2 + x * TILE_SIZE - centerWorld.x,
          top: size.height / 2 + y * TILE_SIZE - centerWorld.y,
          url: `https://tile.openstreetmap.org/${level}/${wrappedX}/${y}.png`,
        });
      }
    }
    return result;
  }, [mapCenter, level, size]);

  const routeLines = useMemo(() => routePaths.map((route) => ({
    ...route,
    points: route.points.map((p) => screenPoint(p, mapCenter, level, size.width, size.height)),
  })), [routePaths, mapCenter, level, size]);

  const moveToBus = (bus: BusMarker) => {
    setSelected(bus);
    setMapCenter(bus.location);
    setLevel(Math.max(level, 14));
  };

  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden rounded-[1.5rem] bg-[#dbeafe]">
      <div className="absolute inset-0">
        {tiles.map((tile) => (
          <img key={`${tile.x}-${tile.y}`} src={tile.url} alt="" className="absolute h-64 w-64 max-w-none select-none" style={{ left: tile.left, top: tile.top }} draggable={false} />
        ))}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none">
          {path.length > 1 && <polyline points={path.map((p) => { const s = screenPoint(p, mapCenter, level, size.width, size.height); return `${s.x},${s.y}`; }).join(" ")} fill="none" stroke="#2563eb" strokeWidth="5" strokeOpacity="0.75" />} 
          {routeLines.map((route) => route.points.length > 1 && (
            <polyline key={route.id} points={route.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={route.color} strokeWidth="5" strokeOpacity="0.82" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>

        {liveBuses.map((bus) => {
          const point = screenPoint(bus.location, mapCenter, level, size.width, size.height);
          const active = selected?.id === bus.id;
          return (
            <button
              key={bus.id}
              type="button"
              onClick={() => moveToBus(bus)}
              className={`absolute -translate-x-1/2 -translate-y-full rounded-xl border-2 border-white px-2 py-1 shadow-lg transition-transform hover:scale-110 ${active ? "z-30 scale-110" : "z-20"}`}
              style={{ left: point.x, top: point.y, background: active ? "#0f766e" : "#0f4c81" }}
              title={`${bus.busNumber} — ${bus.status || "Not started"}`}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-black text-white">
                <Bus className="h-3.5 w-3.5" /> {bus.busNumber}
              </span>
              <span className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1 rotate-45 border-b-2 border-r-2 border-white" style={{ background: active ? "#0f766e" : "#0f4c81" }} />
            </button>
          );
        })}
      </div>

      <div className="absolute right-3 top-3 z-40 flex flex-col overflow-hidden rounded-xl border border-white/80 bg-white/95 shadow-lg">
        <button type="button" onClick={() => setLevel((v) => Math.min(17, v + 1))} className="grid h-10 w-10 place-items-center hover:bg-slate-50"><Plus className="h-4 w-4" /></button>
        <button type="button" onClick={() => setLevel((v) => Math.max(9, v - 1))} className="grid h-10 w-10 place-items-center border-t hover:bg-slate-50"><Minus className="h-4 w-4" /></button>
        <button type="button" onClick={() => setMapCenter(center)} className="grid h-10 w-10 place-items-center border-t hover:bg-slate-50" title="Center map"><LocateFixed className="h-4 w-4" /></button>
      </div>

      {selected && (
        <div className="absolute bottom-3 left-3 z-40 max-w-xs rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
          <p className="font-black text-ink">{selected.busNumber}</p>
          <p className="text-xs font-semibold text-slate-500">Status: {selected.status || "Not started"}</p>
          <p className="text-xs font-semibold text-slate-500">Occupancy: {selected.occupancy || "Unknown"}</p>
          <p className="mt-1 text-[10px] text-slate-400">Live positions refresh every 3 seconds.</p>
        </div>
      )}

      <div className="absolute bottom-2 right-3 z-40 rounded-lg bg-white/85 px-2 py-1 text-[9px] font-semibold text-slate-500 shadow-sm">
        © OpenStreetMap contributors
      </div>
    </div>
  );
}
