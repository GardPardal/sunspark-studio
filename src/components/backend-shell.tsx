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
  PanelLeftClose,
  PanelLeftOpen,
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
    match: (p) =>
      p === "/" ||
      p === "/hoje" ||
      p.startsWith("/hoje") ||
      p.startsWith("/painel") ||
      p.startsWith("/app"),
    show: () => true,
  },
  {
    to: "/clientes",
    label: "Clientes",
    Icon: Users,
    match: (p) =>
      p.startsWith("/clientes") ||
      p.startsWith("/crm") ||
      p.startsWith("/agenda") ||
      p.startsWith("/coordenacao") ||
      p.startsWith("/leads") ||
      p.startsWith("/sdr-leadqualified"),

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
    match: (p) =>
      p.startsWith("/mod/bi") ||
      p.startsWith("/mod/ia") ||
      p.startsWith("/mod/financeiro") ||
      p.startsWith("/vendas") ||
      p.startsWith("/liz-studio"),
    show: () => true,
  },
  {
    to: "/mod",
    label: "Gestão",
    Icon: LayoutGrid,
    match: (p) =>
      p === "/mod" ||
      p.startsWith("/mod/admin") ||
      p.startsWith("/mod/saude") ||
      p.startsWith("/mod/automacoes") ||
      p.startsWith("/mod/chamados") ||
      p.startsWith("/mod/auditoria") ||
      p.startsWith("/admin"),
    show: () => true,
  },
];

// Legacy tabs preserved (backup) — não exibidos por padrão, mas rotas continuam vivas
export const LEGACY_TABS: Tab[] = [
  {
    to: "/agenda",
    label: "Agenda",
    Icon: CalendarClock,
    match: (p) => p.startsWith("/agenda"),
    show: () => true,
  },
  {
    to: "/coordenacao",
    label: "Coord",
    Icon: Users,
    match: (p) => p.startsWith("/coordenacao"),
    show: (r) => !!(r.isAdmin || r.isCoordenador || r.isSdr),
  },
  {
    to: "/admin",
    label: "Admin",
    Icon: Shield,
    match: (p) => p.startsWith("/admin"),
    show: (r) => !!r.isAdmin,
  },
];

/** Itens completos da barra lateral (desktop) — estilo do site LZ7. */
const SIDEBAR_GROUPS: { title: string; items: (Tab & { badgeNew?: boolean })[] }[] = [
  {
    title: "Operação",
    items: [
      TABS[0],
      TABS[1],
      {
        to: "/agenda",
        label: "Agenda",
        Icon: CalendarClock,
        match: (p) => p.startsWith("/agenda"),
        show: () => true,
      },
      {
        to: "/crm",
        label: "CRM",
        Icon: KanbanSquare,
        match: (p) => p.startsWith("/crm"),
        show: () => true,
      },
    ],
  },
  {
    title: "Crescimento",
    items: [
      TABS[2],
      TABS[3],
      {
        to: "/ranking",
        label: "Ranking",
        Icon: Sparkles,
        match: (p) => p.startsWith("/ranking"),
        show: () => true,
      },
      {
        to: "/vendas",
        label: "Vendas",
        Icon: BarChart3,
        match: (p) => p.startsWith("/vendas"),
        show: () => true,
        badgeNew: true,
      },
    ],
  },
  {
    title: "Gestão",
    items: [
      TABS[4],
      {
        to: "/mod/site",
        label: "Site LZ7",
        Icon: Sun,
        match: (p) => p.startsWith("/mod/site"),
        show: (r) => !!(r.isAdmin || r.isCoordenador),
      },
      {
        to: "/admin",
        label: "Admin",
        Icon: Shield,
        match: (p) => p.startsWith("/admin"),
        show: (r) => !!r.isAdmin,
      },
    ],
  },
];

const SIDEBAR_KEY = "lz7:sidebar-collapsed";
const SIDEBAR_EVENT = "lz7:sidebar-collapsed-change";

/** Estado (persistido) de recolhimento da barra lateral do desktop. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* noop */
    }
    const onChange = (e: Event) => setCollapsed((e as CustomEvent<boolean>).detail);
    window.addEventListener(SIDEBAR_EVENT, onChange);
    return () => window.removeEventListener(SIDEBAR_EVENT, onChange);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      window.dispatchEvent(new CustomEvent(SIDEBAR_EVENT, { detail: next }));
      return next;
    });
  };

  return { collapsed, toggle };
}

/** Barra lateral escura (desktop) inspirada no visual do site público. */
export function AppSidebar() {
  const location = useLocation();
  const path = location.pathname;
  const navigate = useNavigate();
  const getRole = useServerFn(getMyRole);
  const { data: role } = useQuery({ queryKey: ["my_role"], queryFn: () => getRole() });
  const { collapsed, toggle } = useSidebarCollapsed();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-navy-line/40 bg-[linear-gradient(180deg,var(--lz-navy-deep)_0%,color-mix(in_oklab,var(--lz-green)_16%,var(--lz-navy-deep))_100%)] transition-[width] duration-200 lg:flex",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      <div
        className={cn(
          "flex h-[72px] shrink-0 items-center gap-2.5",
          collapsed ? "justify-center px-2" : "px-5",
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lzgreen/20 ring-1 ring-lzgreen/30">
          <Sun className="h-4 w-4 text-lzgreen" />
        </span>
        {!collapsed && (
          <span className="font-display text-lg font-extrabold tracking-tight text-white">LZ7</span>
        )}
        {!collapsed && (
          <button
            onClick={toggle}
            aria-label="Recolher menu"
            title="Recolher menu"
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={toggle}
          aria-label="Expandir menu"
          title="Expandir menu"
          className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <nav
        className={cn("flex-1 space-y-6 overflow-y-auto pb-6", collapsed ? "px-2" : "px-3")}
        aria-label="Navegação do sistema"
      >
        {SIDEBAR_GROUPS.map((group) => {
          const items = group.items.filter((i) => i.show(role ?? {}));
          if (!items.length) return null;
          return (
            <div key={group.title}>
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
              ) : (
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                  {group.title}
                </p>
              )}
              <ul className="space-y-1">
                {items.map(({ to, label, Icon, match, badgeNew }) => {
                  const active = match(path);
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        title={label}
                        className={cn(
                          "flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-colors",
                          collapsed ? "justify-center px-0" : "px-3",
                          active
                            ? "bg-lzgreen/18 text-white ring-1 ring-lzgreen/30"
                            : "text-white/70 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0",
                            active ? "text-lzgreen" : "text-white/55",
                          )}
                        />
                        {!collapsed && <span className="min-w-0 truncate">{label}</span>}
                        {!collapsed && badgeNew ? (
                          <span className="ml-auto rounded-full bg-lzgreen px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-navy-deep">
                            Novo
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={signOut}
          title="Sair do sistema"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white",
            collapsed ? "justify-center px-0" : "px-3",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" /> {!collapsed && "Sair do sistema"}
        </button>
      </div>
    </aside>
  );
}

export function BackendTopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

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
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 text-foreground backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 md:px-6">
          <Link to="/hoje" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20 lg:hidden">
              <Sun className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-xl font-extrabold leading-tight tracking-tight md:text-2xl">
                {title}
              </span>
              {subtitle && (
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="mr-1 hidden items-center gap-2 text-xs font-semibold text-muted-foreground xl:inline-flex">
              <CalendarClock className="h-4 w-4" />
              {today}
            </span>
            <button
              onClick={() => setPaletteOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 text-xs font-semibold text-muted-foreground shadow-sm transition hover:text-foreground"
              aria-label="Buscar (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Buscar</span>
              <span className="hidden md:inline font-mono text-[10px] opacity-70">⌘K</span>
            </button>
            <button
              onClick={signOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 text-xs font-semibold text-muted-foreground shadow-sm transition hover:text-foreground lg:hidden"
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
                  <Icon
                    className={cn("h-[18px] w-[18px]", active && "scale-110")}
                    strokeWidth={active ? 2.4 : 2}
                  />
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

export function LinkChip({ to, label, Icon }: { to: string; label: string; Icon: typeof Home }) {
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
