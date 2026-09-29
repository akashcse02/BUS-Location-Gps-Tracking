import { useCallback, useEffect, useState } from "react";
import { db, adminSyncRoutes } from "@/integrations/backend/client";
import {
  DEFAULT_MAP_SETTINGS,
  ROUTE_COLOR_DEFAULTS,
  type MapSettings,
} from "@/config/app-config";
import { FLEET, ROUTES, type FleetBus, type RouteInfo } from "@/lib/bus-fleet";

export const MAP_SETTINGS_KEY = "map_settings";
export const FLEET_ROUTES_KEY = "fleet_routes";

export interface StopConfig {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteConfig {
  id: string;
  name: string;
  color: string;
  stops: StopConfig[];
}

export interface FleetRoutesConfig {
  routes: RouteConfig[];
}

/** Built-in routes expressed as editable config rows. */
export function routesToConfig(routes: RouteInfo[] = ROUTES): RouteConfig[] {
  return routes.map((route) => ({
    id: route.id,
    name: route.name,
    color: route.color,
    stops: route.stops.map((stop) => ({
      name: stop.name,
      lat: stop.position.lat,
      lng: stop.position.lng,
    })),
  }));
}

/** Merge admin overrides on top of the built-in route data. */
export function resolveRoutes(config: RouteConfig[] | null | undefined): RouteInfo[] {
  if (!config || config.length === 0) return ROUTES;
  return config
    .filter((route) => route.id && route.stops?.length)
    .map((route) => ({
      id: route.id,
      name: route.name,
      color: route.color || ROUTE_COLOR_DEFAULTS[route.name] || "#1F72C8",
      stops: route.stops.map((stop) => ({
        name: stop.name,
        position: { lat: Number(stop.lat), lng: Number(stop.lng) },
      })),
    }));
}

/** Re-colour / re-label the fleet from the effective route list. */
export function resolveFleet(routes: RouteInfo[]): FleetBus[] {
  return FLEET.map((bus) => {
    const route = routes.find((r) => r.id === bus.routeId);
    if (!route) return bus;
    return { ...bus, routeName: route.name, color: bus.premium ? bus.color : route.color };
  });
}

async function readConfig<T>(key: string): Promise<T | null> {
  const { data, error } = await db.from("app_config").select("value").eq("key", key).maybeSingle();
  if (error || !data) return null;
  return (data.value as T) ?? null;
}

async function writeConfig(key: string, value: unknown): Promise<{ error: string | null }> {
  const { data: auth } = await db.auth.getUser();
  const { error } = await db
    .from("app_config")
    .upsert(
      { key, value: value as never, updated_at: new Date().toISOString(), updated_by: auth.user?.id ?? null },
      { onConflict: "key" },
    );
  return { error: error ? error.message : null };
}

export function useMapSettings() {
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_MAP_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const value = await readConfig<Partial<MapSettings>>(MAP_SETTINGS_KEY);
      if (cancelled) return;
      if (value) setSettings({ ...DEFAULT_MAP_SETTINGS, ...value });
      setLoading(false);
    };
    void load();
    const timer = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const save = useCallback(async (next: MapSettings) => {
    setSettings(next);
    return writeConfig(MAP_SETTINGS_KEY, next);
  }, []);

  return { settings, setSettings, loading, save };
}

export function useRouteConfig() {
  const [routeConfig, setRouteConfig] = useState<RouteConfig[]>(routesToConfig());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const value = await readConfig<FleetRoutesConfig>(FLEET_ROUTES_KEY);
      if (cancelled) return;
      if (value?.routes?.length) setRouteConfig(value.routes);
      setLoading(false);
    };
    void load();
    const timer = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const save = useCallback(async (next: RouteConfig[]) => {
    setRouteConfig(next);
    const configResult = await writeConfig(FLEET_ROUTES_KEY, { routes: next } satisfies FleetRoutesConfig);
    if (configResult.error) return configResult;
    const sync = await adminSyncRoutes(next);
    if (!sync.res.ok) return { error: sync.json?.message || "Could not synchronize routes with MongoDB" };
    return { error: null };
  }, []);

  const resetToDefaults = useCallback(async () => {
    const defaults = routesToConfig();
    setRouteConfig(defaults);
    return writeConfig(FLEET_ROUTES_KEY, { routes: [] } satisfies FleetRoutesConfig);
  }, []);

  return { routeConfig, setRouteConfig, loading, save, resetToDefaults };
}
