import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { surface } from "./tokens";
import type { Intent } from "./tokens";
import { DsBadge } from "./badge";

/**
 * Solar OS v2 — KPI stat card. Used across Home/BI.
 * Value is the hero; delta and trend are secondary.
 */
export function DsStat({
  label,
  value,
  delta,
  deltaIntent,
  hint,
  icon,
  onClick,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  /** success = positive/up, danger = negative/down */
  deltaIntent?: Extract<Intent, "success" | "danger" | "neutral">;
  hint?: string;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const clickable = typeof onClick === "function";
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      className={cn(
        surface(1),
        "p-5",
        clickable && "cursor-pointer transition-shadow hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            {value}
          </div>
          {hint ? <div className="mt-1 text-[12px] text-muted-foreground">{hint}</div> : null}
        </div>
        {icon ? <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">{icon}</div> : null}
      </div>
      {delta ? (
        <div className="mt-3">
          <DsBadge intent={deltaIntent ?? "neutral"} dot={false}>
            {deltaIntent === "success" ? <ArrowUp className="h-3 w-3" /> : deltaIntent === "danger" ? <ArrowDown className="h-3 w-3" /> : null}
            {delta}
          </DsBadge>
        </div>
      ) : null}
    </div>
  );
}
