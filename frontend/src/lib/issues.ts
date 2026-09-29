import { useCallback, useEffect, useState } from "react";

// Talks to the dedicated backend/routes/issues.js endpoints directly
// (not the generic /db/:table shim), same token the db-shim stores.
const TOKEN_KEY = "pub_bus_track_token";

function apiBase(): string {
  const fromVite = (import.meta as any)?.env?.["VITE_API_URL"];
  if (fromVite) return fromVite;
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  return "http://localhost:5000/api";
}

async function issuesFetch(path: string, init: RequestInit = {}) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/issues${path}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Request failed");
  return json;
}

export interface Issue {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  status: "pending" | "investigating" | "resolved" | "closed";
  created_at: string;
}

/** The signed-in user's own reported issues, plus a submit helper. */
export function useMyIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await issuesFetch("/mine");
      setIssues(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const report = useCallback(
    async (input: { title: string; description?: string; category?: string }) => {
      await issuesFetch("/", { method: "POST", body: JSON.stringify(input) });
      await load();
    },
    [load],
  );

  return { issues, loading, report, reload: load };
}

/** Admin-only: every reported issue, optionally filtered by status. */
export function useAllIssues(status?: Issue["status"]) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = status ? `?status=${status}` : "";
      const data = await issuesFetch(query);
      setIssues(data);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = useCallback(
    async (id: string, next: Issue["status"]) => {
      await issuesFetch(`/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await issuesFetch(`/${id}`, { method: "DELETE" });
      await load();
    },
    [load],
  );

  return { issues, loading, updateStatus, remove, reload: load };
}
