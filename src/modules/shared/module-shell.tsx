import { Link, useLocation, useRouteContext } from "@tanstack/react-router";
import { BackendTopBar } from "@/components/backend-shell";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Megaphone,
  Sparkles,
  BarChart3,
  Wallet,
  ShieldCheck,
  KanbanSquare,
  Activity,
  Zap,
  LifeBuoy,
  Users,
  MessageSquare,
  Boxes,
  Globe,
  UserRoundSearch,
} from "lucide-react";

type Mod = {
  key: string;
  label: string;
  to: string;
  Icon: typeof LayoutGrid;
  hint: string;
  tone: string;
  external?: boolean;
};

export const MODULES: Mod[] = [
  {
    key: "crm",
    label: "CRM",
    to: "/crm",
    Icon: KanbanSquare,
    hint: "Operação: leads, agenda, funil",
    tone: "text-primary",
    external: true,
  },
  {
    key: "marketing",
    label: "Marketing",
    to: "/mod/marketing",
    Icon: Megaphone,
    hint: "Meta Ads, hub, diagnóstico",
    tone: "text-fuchsia-600",
  },
  {
    key: "ia",
    label: "IA",
    to: "/mod/ia",
    Icon: Sparkles,
    hint: "Insights e recomendações",
    tone: "text-amber-600",
  },
  {
    key: "bi",
    label: "BI",
    to: "/mod/bi",
    Icon: BarChart3,
    hint: "Dashboards por perfil",
    tone: "text-emerald-700",
  },
  {
    key: "financeiro",
    label: "Financeiro",
    to: "/mod/financeiro",
    Icon: Wallet,
    hint: "Receita, CAC, ROAS, margem",
    tone: "text-blue-700",
  },
  {
    key: "vendas",
    label: "Vendas & Faturamento",
    to: "/vendas",
    Icon: Wallet,
    hint: "Controle interno de vendas e recebimentos",
    tone: "text-emerald-700",
    external: true,
  },
  {
    key: "admin",
    label: "Administração",
    to: "/mod/admin",
    Icon: ShieldCheck,
    hint: "Saúde, integrações, logs",
    tone: "text-slate-700",
  },
  {
    key: "auditoria",
    label: "Auditoria",
    to: "/mod/auditoria",
    Icon: LayoutGrid,
    hint: "Inventário e mapa por objetivo",
    tone: "text-slate-600",
  },
  {
    key: "saude",
    label: "Saúde",
    to: "/mod/saude",
    Icon: Activity,
    hint: "Status vivo das integrações",
    tone: "text-emerald-600",
  },
  {
    key: "automacoes",
    label: "Automações",
    to: "/mod/automacoes",
    Icon: Zap,
    hint: "Workflows: trigger → passos",
    tone: "text-orange-600",
  },
  {
    key: "chamados",
    label: "Chamados",
    to: "/mod/chamados",
    Icon: LifeBuoy,
    hint: "Portal do cliente pós-venda",
    tone: "text-sky-600",
  },
  {
    key: "responsaveis",
    label: "Responsáveis",
    to: "/mod/responsaveis",
    Icon: Users,
    hint: "Ploomes ↔ logins ↔ vendedores",
    tone: "text-indigo-600",
  },
  {
    key: "meta-debug",
    label: "Meta CAPI",
    to: "/mod/meta-debug",
    Icon: ShieldCheck,
    hint: "Debug e auditoria de conversões",
    tone: "text-blue-600",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    to: "/mod/whatsapp",
    Icon: MessageSquare,
    hint: "Caixa de entrada, IA e base de conhecimento",
    tone: "text-green-600",
  },
  {
    key: "inventario",
    label: "Inventário",
    to: "/inventario",
    Icon: Boxes,
    hint: "Estoque físico e saldo de inventário",
    tone: "text-teal-600",
    external: true,
  },
  {
    key: "rh",
    label: "RH",
    to: "/mod/rh",
    Icon: UserRoundSearch,
    hint: "Vagas, candidaturas e processo seletivo",
    tone: "text-rose-600",
  },
  {
    key: "site",
    label: "Site LZ7",
    to: "/mod/site",
    Icon: Globe,
    hint: "CMS do portal, blog, vagas e caixa de entrada",
    tone: "text-lzgreen",
  },
];

export function ModuleShell({
  title,
  subtitle,
  active,
  children,
}: {
  title: string;
  subtitle?: string;
  active: string;
  children: React.ReactNode;
}) {
  const loc = useLocation();
  const ctx = useRouteContext({ from: "/_authenticated" }) as { isRhOnly?: boolean };
  // Perfil exclusivo de RH enxerga apenas o módulo de RH
  const visibleModules = ctx?.isRhOnly ? MODULES.filter((m) => m.key === "rh") : MODULES;

  return (
    <div className="min-h-screen bg-secondary/30 pb-20">
      <BackendTopBar title={title} subtitle={subtitle ?? "Sistema Operacional Comercial"} />

      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 space-y-4">
        {/* Navegação horizontal compacta de submódulos */}
        {!ctx?.isRhOnly && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <Link
              to="/mod"
              className={cn(
                "inline-flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border",
                loc.pathname === "/mod"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Visão Geral
            </Link>

            {visibleModules.map((m) => {
              const isActive = active === m.key;
              return (
                <Link
                  key={m.key}
                  to={m.to}
                  className={cn(
                    "inline-flex items-center gap-1.5 shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
                  )}
                >
                  <m.Icon
                    className={cn("h-3.5 w-3.5", isActive ? "text-primary-foreground" : m.tone)}
                  />
                  {m.label}
                </Link>
              );
            })}
          </div>
        )}

        <main className="min-w-0 space-y-4">{children}</main>
      </div>
    </div>
  );
}
