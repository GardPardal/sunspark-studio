import { Link, useLocation } from "@tanstack/react-router";
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
  { key: "crm",        label: "CRM",         to: "/crm",             Icon: KanbanSquare, hint: "Operação: leads, agenda, funil", tone: "text-primary", external: true },
  { key: "marketing",  label: "Marketing",   to: "/mod/marketing",   Icon: Megaphone,    hint: "Meta Ads, hub, diagnóstico",     tone: "text-fuchsia-600" },
  { key: "ia",         label: "IA",          to: "/mod/ia",          Icon: Sparkles,     hint: "Insights e recomendações",       tone: "text-amber-600" },
  { key: "bi",         label: "BI",          to: "/mod/bi",          Icon: BarChart3,    hint: "Dashboards por perfil",          tone: "text-emerald-700" },
  { key: "financeiro", label: "Financeiro",  to: "/mod/financeiro",  Icon: Wallet,      hint: "Receita, CAC, ROAS, margem",     tone: "text-blue-700" },
  { key: "admin",      label: "Administração", to: "/mod/admin",     Icon: ShieldCheck,  hint: "Saúde, integrações, logs",       tone: "text-slate-700" },
  { key: "auditoria",  label: "Auditoria",   to: "/mod/auditoria",   Icon: LayoutGrid,   hint: "Inventário e mapa por objetivo", tone: "text-slate-600" },
  { key: "saude",      label: "Saúde",       to: "/mod/saude",       Icon: Activity,     hint: "Status vivo das integrações",    tone: "text-emerald-600" },
  { key: "automacoes", label: "Automações",  to: "/mod/automacoes",  Icon: Zap,          hint: "Workflows: trigger → passos",    tone: "text-orange-600" },
  { key: "chamados",   label: "Chamados",    to: "/mod/chamados",    Icon: LifeBuoy,     hint: "Portal do cliente pós-venda",    tone: "text-sky-600" },
  { key: "responsaveis", label: "Responsáveis", to: "/mod/responsaveis", Icon: Users, hint: "Ploomes ↔ logins ↔ vendedores", tone: "text-indigo-600" },
  { key: "meta-debug", label: "Meta CAPI",   to: "/mod/meta-debug",  Icon: ShieldCheck,  hint: "Debug e auditoria de conversões", tone: "text-blue-600" },
  { key: "whatsapp",   label: "WhatsApp",    to: "/mod/whatsapp",    Icon: MessageSquare, hint: "Caixa de entrada, IA e base de conhecimento", tone: "text-green-600" },
  { key: "inventario", label: "Inventário",  to: "/inventario",      Icon: Boxes,        hint: "Estoque físico e saldo de inventário", tone: "text-teal-600", external: true },
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
  return (
    <div className="min-h-screen bg-secondary/30 pb-24">
      <BackendTopBar title={title} subtitle={subtitle ?? "Sistema Operacional Comercial"} />
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-4">
        <div className="flex gap-4">
          <aside className="hidden md:block w-56 shrink-0">
            <nav className="sticky top-20 space-y-1 rounded-2xl border border-border/60 bg-card p-2 shadow-sm">
              <Link
                to="/mod"
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium",
                  loc.pathname === "/mod" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <LayoutGrid className="h-4 w-4" /> Todos os módulos
              </Link>
              {MODULES.map((m) => (
                <Link
                  key={m.key}
                  to={m.to}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition",
                    active === m.key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  <m.Icon className={cn("h-4 w-4", m.tone)} />
                  {m.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="min-w-0 flex-1 space-y-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
