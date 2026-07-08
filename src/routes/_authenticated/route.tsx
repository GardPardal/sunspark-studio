import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LizChat } from "@/components/liz-chat";
import { BottomTabBar } from "@/components/backend-shell";

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
    const isSdr = roles.includes("sdr");

    // /admin: só admin
    if (location.pathname.startsWith("/admin") && !isAdmin) {
      throw redirect({ to: isCoordenador || isSdr ? "/coordenacao" : "/crm" });
    }
    // /coordenacao: coordenador, admin ou SDR (Stephany opera aqui)
    if (location.pathname.startsWith("/coordenacao") && !isAdmin && !isCoordenador && !isSdr) {
      throw redirect({ to: "/crm" });
    }
    // Landing padrão do painel
    // Landing padrão do painel
    if (location.pathname === "/_authenticated" || location.pathname === "/painel") {
      throw redirect({ to: isAdmin ? "/admin" : (isCoordenador || isSdr) ? "/coordenacao" : "/app" });
    }

    return { user: data.user, roles, isAdmin, isConsultor, isCoordenador, isSdr };

  },
  component: () => (
    <div className="min-h-screen w-full overflow-x-hidden pb-[calc(72px+env(safe-area-inset-bottom))]">
      <Outlet />
      <BottomTabBar />
      <LizChat mode="internal" triggerLabel="LIZ · IA do time" />
    </div>
  ),
});
