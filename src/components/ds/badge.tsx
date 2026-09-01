import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { type Intent, intentSoft, intentDot } from "./tokens";

type Props = {
  intent?: Intent;
  children: ReactNode;
  dot?: boolean;
  className?: string;
  size?: "sm" | "md";
};

/** Solar OS v2 badge. `dot` toggles the small colored indicator. */
export function DsBadge({ intent = "neutral", children, dot, className, size = "md" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold whitespace-nowrap",
        size === "sm" ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-[11px]",
        "rounded-full",
        intentSoft[intent],
        className,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", intentDot[intent])} /> : null}
      {children}
    </span>
  );
}

/** Numeric badge (for tabs/nav counts). Clamps at 9+ */
export function DsCount({
  value,
  intent = "primary",
  className,
}: {
  value: number;
  intent?: Intent;
  className?: string;
}) {
  if (value <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none h-[18px]",
        intentSoft[intent],
        className,
      )}
    >
      {value > 9 ? "9+" : value}
    </span>
  );
}
