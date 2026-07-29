import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { DsBadge } from "./badge";
import type { Intent } from "./tokens";

/**
 * Solar OS v2 — page header.
 * One title, one optional subtitle, one status, one primary action, up to 2 secondary.
 * Enforces "one action primary per screen" rule.
 */
export function DsPageHeader({
  title,
  subtitle,
  status,
  statusIntent = "neutral",
  primary,
  secondary,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: string;
  statusIntent?: Intent;
  primary?: ReactNode;
  secondary?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        {back ? <div className="mb-2">{back}</div> : null}
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[22px] md:text-[26px] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {status ? <DsBadge intent={statusIntent} dot>{status}</DsBadge> : null}
        </div>
        {subtitle ? (
          <p className="mt-1 text-[13px] md:text-[14px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {(primary || secondary) && (
        <div className="flex flex-wrap items-center gap-2">
          {secondary}
          {primary}
        </div>
      )}
    </div>
  );
}

export function DsSection({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mb-8", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title ? <h2 className="font-display text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
