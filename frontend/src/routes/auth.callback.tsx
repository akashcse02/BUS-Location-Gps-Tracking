import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { db } from "@/integrations/backend/client";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const hashToken = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
    if (hashToken) {
      window.history.replaceState({}, document.title, window.location.pathname);
      void db.auth.completeOAuthToken(hashToken).then(({ error }) => {
        if (error) navigate({ to: "/login" });
      });
    }
    const { data: authListener } = db.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          // Fetch user role
          const { data: roleData } = await db
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .single();

          void roleData;
          navigate({ to: "/dashboard" });
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-bold text-ink/60">Completing sign in...</p>
      </div>
    </div>
  );
}
