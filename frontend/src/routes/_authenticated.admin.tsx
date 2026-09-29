import { createFileRoute, redirect } from "@tanstack/react-router";
import { db } from "@/integrations/backend/client";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";

export const Route = createFileRoute("/_authenticated/admin")({
  // Session lookup now goes through our own backend via a browser-stored
  // token (see src/integrations/db/client.ts), so this loader — like
  // the parent _authenticated route — needs to run client-side.
  ssr: false,
  loader: async () => {
    const { data: { session } } = await db.auth.getSession();

    if (!session) {
      throw redirect({ to: "/login" });
    }

    // Role is verified against the RLS-protected user_roles table,
    // never from client state or props.
    const { data: roles } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      throw redirect({ to: "/live-location" });
    }

    return { isAdmin: true };
  },
  head: () => ({
    title: "Admin Dashboard — PUB Bus Track",
    meta: [{ name: "description", content: "Administrative overview and management." }],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  return <AdminDashboard />;
}
