import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Role-based landing: consultores that hit /admin get bounced to /crm.
    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin");
    const isConsultor = roles.includes("consultor");

    if (location.pathname.startsWith("/admin") && !isAdmin) {
      throw redirect({ to: "/crm" });
    }
    if (location.pathname === "/_authenticated" || location.pathname === "/painel") {
      throw redirect({ to: isAdmin ? "/admin" : "/crm" });
    }

    return { user: data.user, roles, isAdmin, isConsultor };
  },
  component: () => <Outlet />,
});
