// Thin client for our own MongoDB/Express backend (see /backend for the
// real Express + Mongoose implementation). It exposes a small Postgrest-like
// query builder (`db.from(...)`) and an auth namespace (`db.auth...`) so the
// rest of the app can use one consistent, chainable API.
//
// Notes: Google sign-in is not implemented, and "realtime" is done by polling.

import type { Database } from "./types";

function apiBase(): string {
  const fromVite = (import.meta as any)?.env?.["VITE_API_URL"];
  const fromProcess = typeof process !== "undefined" ? process.env?.["API_URL"] : undefined;
  if (fromVite) return fromVite;
  if (fromProcess) return fromProcess;
  // No env set: talk to the backend on the same machine the page was opened from
  // (works for localhost, 127.0.0.1 and LAN IPs alike).
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  return "http://localhost:5000/api";
}

const TOKEN_KEY = "pub_bus_track_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `${apiBase()}${path}`;
  try {
    const res = await fetch(url, { ...init, headers });
    const json = await res.json().catch(() => ({}));
    return { res, json };
  } catch {
    // Network-level failure (backend not running / wrong URL / blocked).
    const message = `Cannot reach the backend at ${apiBase()}. Start it with "cd backend && npm start" and check that the terminal says "API running".`;
    return {
      res: { ok: false, status: 0 } as Response,
      json: { message, data: null, error: { message } } as any,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Query builder — mimics the handful of Postgrest patterns this app  */
/*  actually uses: .select().eq().neq().in().order().limit().single()  */
/*  .maybeSingle(), plus .insert()/.update()/.upsert()/.delete().      */
/* ------------------------------------------------------------------ */

type Filter = [string, "eq" | "neq" | "in" | "gt" | "gte" | "lt" | "lte", unknown];
type Order = { column: string; ascending: boolean };

class QueryBuilder<T = any> implements PromiseLike<{ data: T | null; error: any; count?: number }> {
  private table: string;
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitVal?: number;
  private countOnly = false;
  private values?: unknown;
  private onConflictCol?: string;
  private returning?: "single" | "maybeSingle";
  private selectStr?: string;

  constructor(table: string) {
    this.table = table;
  }

  select(cols?: string, opts?: { count?: "exact"; head?: boolean }) {
    if (cols !== undefined) this.selectStr = cols;
    if (opts?.count === "exact" && opts.head) this.countOnly = true;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, "eq", value]);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push([column, "neq", value]);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push([column, "in", values]);
    return this;
  }
  gt(column: string, value: unknown) { this.filters.push([column, "gt", value]); return this; }
  gte(column: string, value: unknown) { this.filters.push([column, "gte", value]); return this; }
  lt(column: string, value: unknown) { this.filters.push([column, "lt", value]); return this; }
  lte(column: string, value: unknown) { this.filters.push([column, "lte", value]); return this; }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitVal = n;
    return this;
  }
  single() {
    this.returning = "single";
    return this;
  }
  maybeSingle() {
    this.returning = "maybeSingle";
    return this;
  }

  insert(values: unknown) {
    this.action = "insert";
    this.values = values;
    return this;
  }
  update(values: unknown) {
    this.action = "update";
    this.values = values;
    return this;
  }
  upsert(values: unknown, opts?: { onConflict?: string }) {
    this.action = "upsert";
    this.values = values;
    if (opts?.onConflict !== undefined) this.onConflictCol = opts.onConflict;
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }

  private async execute() {
    const spec = {
      action: this.action,
      select: this.selectStr,
      filters: this.filters,
      order: this.orders,
      limit: this.limitVal,
      countOnly: this.countOnly,
      values: this.values,
      onConflict: this.onConflictCol,
      returning: this.returning,
    };
    const { json } = await apiFetch(`/db/${this.table}`, { method: "POST", body: JSON.stringify(spec) });
    return json as { data: T | null; error: any; count?: number };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: T | null; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }
}

/* ------------------------------------------------------------------ */
/*  Auth — a minimal auth namespace covering what this app needs.      */
/* ------------------------------------------------------------------ */

type AuthListener = (event: string, session: any) => void;
const authListeners: AuthListener[] = [];

function toSession(payload: { token: string; user: any }) {
  return { access_token: payload.token, user: payload.user };
}

const auth = {
  async getSession() {
    const token = getToken();
    if (!token) return { data: { session: null }, error: null };
    const { res, json } = await apiFetch("/auth/session");
    if (!res.ok) {
      if (res.status === 401) setToken(null); // only drop the token when it's truly invalid
      return { data: { session: null }, error: null };
    }
    return { data: { session: toSession(json) }, error: null };
  },

  async getUser() {
    const { data } = await auth.getSession();
    return { data: { user: data.session?.user ?? null }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const { res, json } = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return { data: { user: null, session: null }, error: { message: json.message || "Login failed", code: json.code, email: json.email } };
    setToken(json.token);
    const session = toSession(json);
    authListeners.forEach((cb) => cb("SIGNED_IN", session));
    return { data: { user: session.user, session }, error: null };
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, any> } }) {
    const meta = options?.data || {};
    const { res, json } = await apiFetch("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        full_name: meta["full_name"],
        role: meta["role"],
        id_number: meta["id_number"],
        department: meta["department"],
        phone_number: meta["phone_number"],
      }),
    });
    if (!res.ok) return { data: { user: null, session: null }, error: { message: json.message || "Sign up failed", code: json.code, email: json.email } };
    if (json.verification_required) return { data: { user: null, session: null, verification_required: true, email: json.email, development_code: json.development_code }, error: null } as any;
    setToken(json.token);
    const session = toSession(json);
    authListeners.forEach((cb) => cb("SIGNED_IN", session));
    return { data: { user: session.user, session }, error: null };
  },

  // Google OAuth isn't implemented in this MongoDB-based build — it would
  // need its own Google OAuth client (separate from MongoDB) to work.
  // Surfaced as a normal error so the existing try/catch + toast in
  // login.tsx / signup.tsx shows it to the user instead of crashing.

  async verifyEmailCode({ email, code }: { email: string; code: string }) {
    const { res, json } = await apiFetch("/auth/verify-email", { method: "POST", body: JSON.stringify({ email, code }) });
    if (!res.ok) return { data: { user: null, session: null }, error: { message: json.message || "Verification failed" } };
    setToken(json.token);
    const session = toSession(json);
    authListeners.forEach((cb) => cb("SIGNED_IN", session));
    return { data: { user: session.user, session }, error: null };
  },

  async resendVerificationCode(email: string) {
    const { res, json } = await apiFetch("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) });
    if (!res.ok) return { error: { message: json.message || "Could not resend code" }, development_code: json.development_code };
    return { error: null, message: json.message, development_code: json.development_code };
  },

  async signInWithOAuth(args?: { provider?: string; options?: { redirectTo?: string } }) {
    if (args?.provider !== "google") return { error: { message: "Only Google OAuth is supported." } };
    if (typeof window !== "undefined") {
      window.location.href = `${apiBase()}/auth/google`;
      return { error: null };
    }
    return { error: { message: "OAuth is only available in a browser." } };
  },

  async completeOAuthToken(token: string) {
    setToken(token);
    const { data, error } = await auth.getSession();
    if (error || !data.session) return { error: error || { message: "Invalid OAuth session" } };
    authListeners.forEach((cb) => cb("SIGNED_IN", data.session));
    return { data: data.session, error: null };
  },

  async signOut() {
    setToken(null);
    authListeners.forEach((cb) => cb("SIGNED_OUT", null));
    return { error: null };
  },

  onAuthStateChange(callback: AuthListener) {
    authListeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe() {
            const i = authListeners.indexOf(callback);
            if (i >= 0) authListeners.splice(i, 1);
          },
        },
      },
    };
  },
};

/* ------------------------------------------------------------------ */
/*  Realtime — no websocket server here, so "subscribe to changes" is   */
/*  implemented as polling. Good enough for a campus bus tracker where  */
/*  a few seconds of staleness doesn't matter; documented in            */
/*  a deliberate simplification.                                        */
/* ------------------------------------------------------------------ */

const POLL_MS = 5000;

function channel(name: string) {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const api = {
    on(_event: string, _filter: any, callback: () => void) {
      intervalId = setInterval(callback, POLL_MS);
      return api;
    },
    subscribe() {
      return { name };
    },
    _stop() {
      if (intervalId) clearInterval(intervalId);
    },
  };
  return api;
}

function wrappedChannel(name: string) {
  return channel(name);
}

function removeChannel(ch: any) {
  ch?._stop?.();
}

/* ------------------------------------------------------------------ */

export const db = {
  from<TName extends string>(table: TName) {
    return new QueryBuilder(table);
  },
  auth,
  channel: wrappedChannel,
  removeChannel,
};

export async function adminSyncRoutes(routes: Array<{ id?: string; name: string; color?: string; stops: Array<{ name: string; lat: number; lng: number }> }>) {
  return apiFetch("/admin/routes/sync", { method: "PUT", body: JSON.stringify({ routes }) });
}

export async function trackingStart(payload: { busId?: string; routeId?: string; occupancy?: "low" | "medium" | "high" }) {
  return apiFetch("/tracking/start", { method: "POST", body: JSON.stringify(payload) });
}

export async function trackingLocation(tripId: string, payload: { lat: number; lng: number; speed?: number | null; bearing?: number | null; accuracy?: number | null }) {
  return apiFetch(`/tracking/${tripId}/location`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function trackingStatus(tripId: string, status: "in_progress" | "delayed" | "completed" | "cancelled") {
  return apiFetch(`/tracking/${tripId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function trackingOccupancy(tripId: string, occupancy: "low" | "medium" | "high") {
  return apiFetch(`/tracking/${tripId}/occupancy`, { method: "PATCH", body: JSON.stringify({ occupancy }) });
}

export async function trackingSOS(payload: { tripId?: string; lat?: number; lng?: number; message?: string }) {
  return apiFetch("/tracking/sos", { method: "POST", body: JSON.stringify(payload) });
}

export async function trackingLive() {
  return apiFetch("/tracking/live");
}
