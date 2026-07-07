import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roles.includes("admin");
    const isConsultor = roles.includes("consultor");
    const isCoordenador = roles.includes("coordenador");

    // /admin: só admin
    if (location.pathname.startsWith("/admin") && !isAdmin) {
      throw redirect({ to: isCoordenador ? "/coordenacao" : "/crm" });
    }
    // /coordenacao: coordenador ou admin
    if (location.pathname.startsWith("/coordenacao") && !isAdmin && !isCoordenador) {
      throw redirect({ to: "/crm" });
    }
    // Landing padrão do painel
    if (location.pathname === "/_authenticated" || location.pathname === "/painel") {
      throw redirect({ to: isAdmin ? "/admin" : isCoordenador ? "/coordenacao" : "/crm" });
    }

    return { user: data.user, roles, isAdmin, isConsultor, isCoordenador };
  },
  component: () => <Outlet />,
});
