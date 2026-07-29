import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/admin-users.functions";
import {
  Home,
  KanbanSquare,
  Users,
  Shield,
  Smartphone,
  LogOut,
  Sun,
  CalendarClock,
  LayoutGrid,
  Search,
  Megaphone,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/solar/command-palette";
import { LizFab } from "@/components/solar/liz-fab";

type Role = { isAdmin?: boolean; isCoordenador?: boolean; isSdr?: boolean; isConsultor?: boolean };

type Tab = {
  to: string;
  label: string;
  Icon: typeof Home;
  match: (path: string) => boolean;
  show: (r: Role) => boolean;
};

/**
 * Solar OS v2 — Menu único de 5 slots, adaptativo por role.
 * Ordem fixa: Hoje · Trabalho · Marketing · Inteligência · Gestão.
 */
const TABS: Tab[] = [
  {
    to: "/hoje",
    label: "Hoje",
    Icon: Home,
    match: (p) => p === "/" || p === "/hoje" || p.startsWith("/hoje") || p.startsWith("/painel") || p.startsWith("/app"),
    show: () => true,
  },
  {
    to: "/crm",
    label: "Trabalho",
    Icon: KanbanSquare,
    match: (p) => p.startsWith("/crm") || p.startsWith("/agenda") || p.startsWith("/coordenacao"),
    show: () => true,
  },
  {
    to: "/mod/marketing",
    label: "Marketing",
    Icon: Megaphone,
    match: (p) => p.startsWith("/mod/marketing") || p.startsWith("/marketing-hub"),
    show: (r) => !!(r.isAdmin || r.isCoordenador || r.isSdr),
  },
  {
    to: "/mod/bi",
    label: "Inteligência",
    Icon: BarChart3,
    match: (p) => p.startsWith("/mod/bi") || p.startsWith("/mod/ia") || p.startsWith("/mod/financeiro") || p.startsWith("/liz-studio"),
    show: () => true,
  },
  {
    to: "/mod",
    label: "Gestão",
    Icon: LayoutGrid,
    match: (p) => p === "/mod" || p.startsWith("/mod/admin") || p.startsWith("/mod/saude") || p.startsWith("/mod/automacoes") || p.startsWith("/mod/chamados") || p.startsWith("/mod/auditoria") || p.startsWith("/admin"),
    show: () => true,
  },
];

// Legacy tabs preserved (backup) — não exibidos por padrão, mas rotas continuam vivas
export const LEGACY_TABS: Tab[] = [
  { to: "/agenda", label: "Agenda", Icon: CalendarClock, match: (p) => p.startsWith("/agenda"), show: () => true },
  { to: "/coordenacao", label: "Coord", Icon: Users, match: (p) => p.startsWith("/coordenacao"), show: (r) => !!(r.isAdmin || r.isCoordenador || r.isSdr) },
  { to: "/admin", label: "Admin", Icon: Shield, match: (p) => p.startsWith("/admin"), show: (r) => !!r.isAdmin },
];

export function BackendTopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-primary/10 bg-[radial-gradient(120%_120%_at_0%_0%,color-mix(in_oklab,var(--primary)_88%,black)_0%,var(--primary)_60%)] text-primary-foreground backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/hoje" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-foreground/15 ring-1 ring-primary-foreground/20">
              <Sun className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[15px] font-semibold leading-tight tracking-tight">
                {title}
              </span>
              {subtitle && (
                <span className="block truncate text-[11px] font-medium text-primary-foreground/70">
                  {subtitle}
                </span>
              )}
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPaletteOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 text-xs font-semibold hover:bg-primary-foreground/20"
              aria-label="Buscar (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Buscar</span>
              <span className="hidden md:inline font-mono text-[10px] opacity-70">⌘K</span>
            </button>
            <button
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 text-xs font-semibold hover:bg-primary-foreground/20"
              aria-label="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

export function BottomTabBar() {
  const location = useLocation();
  const path = location.pathname;
  const getRole = useServerFn(getMyRole);
  const { data: role } = useQuery({ queryKey: ["my_role"], queryFn: () => getRole() });

  const tabs = TABS.filter((t) => t.show(role ?? {}));

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)]"
    >
      <ul
        className="mx-auto grid max-w-md"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ to, label, Icon, match }) => {
          const active = match(path);
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-1 py-2.5 text-[10px] font-semibold tracking-wide transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-12 place-items-center rounded-full transition-all",
                    active ? "bg-primary/12 ring-1 ring-primary/20" : "bg-transparent",
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px]", active && "scale-110")} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className="uppercase tracking-wider">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Wrap authenticated pages: adds bottom padding so content clears the tab bar
 * and mounts the global LIZ copilot FAB.
 */
export function BackendShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/30 pb-[calc(72px+env(safe-area-inset-bottom))]">
      {children}
      <BottomTabBar />
      <LizFab />
    </div>
  );
}

export function LinkChip({
  to,
  label,
  Icon,
}: {
  to: string;
  label: string;
  Icon: typeof Home;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary-foreground/20"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

// Convenience re-export
export { Smartphone };
