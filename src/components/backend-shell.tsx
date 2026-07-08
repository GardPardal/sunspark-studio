import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  to: string;
  label: string;
  Icon: typeof Home;
  match: (path: string) => boolean;
  show: (r: { isAdmin?: boolean; isCoordenador?: boolean; isSdr?: boolean; isConsultor?: boolean }) => boolean;
};

const TABS: Tab[] = [
  {
    to: "/app",
    label: "Hoje",
    Icon: Home,
    match: (p) => p === "/" || p.startsWith("/app") || p.startsWith("/painel"),
    show: () => true,
  },
  {
    to: "/crm",
    label: "Leads",
    Icon: KanbanSquare,
    match: (p) => p.startsWith("/crm"),
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

export function BackendTopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };
  return (
    <header className="sticky top-0 z-30 border-b border-primary/10 bg-[radial-gradient(120%_120%_at_0%_0%,color-mix(in_oklab,var(--primary)_88%,black)_0%,var(--primary)_60%)] text-primary-foreground backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
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
        <button
          onClick={signOut}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 text-xs font-semibold hover:bg-primary-foreground/20"
          aria-label="Sair"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
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
                  "flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-[10px] font-semibold tracking-wide transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-14 place-items-center rounded-full transition-all",
                    active
                      ? "bg-primary/12 ring-1 ring-primary/20"
                      : "bg-transparent",
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px]", active && "scale-110")} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className="uppercase">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Wrap authenticated pages: adds bottom padding so content clears the tab bar.
 */
export function BackendShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/30 pb-[calc(72px+env(safe-area-inset-bottom))]">
      {children}
      <BottomTabBar />
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
