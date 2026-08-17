import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LizChat } from "@/components/liz-chat";
import { AppSidebar, BottomTabBar, useSidebarCollapsed } from "@/components/backend-shell";
import { OfflineQueueManager } from "@/components/offline-queue-manager";

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
    // Landing padrão do painel — novo fluxo (Centro de Operações)
    if (location.pathname === "/_authenticated" || location.pathname === "/painel" || location.pathname === "/app") {
      throw redirect({ to: "/hoje" });
    }


    return { user: data.user, roles, isAdmin, isConsultor, isCoordenador, isSdr };

  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { collapsed } = useSidebarCollapsed();
  return (
    <div
      className={
        "min-h-screen w-full overflow-x-hidden bg-secondary/30 pb-[calc(72px+env(safe-area-inset-bottom))] transition-[padding] duration-200 lg:pb-0 " +
        (collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]")
      }
    >
      <AppSidebar />
      <Outlet />
      <div className="lg:hidden">
        <BottomTabBar />
      </div>
      <OfflineQueueManager />
      <LizChat mode="internal" triggerLabel="LIZ · IA do time" />
    </div>
  );
}
