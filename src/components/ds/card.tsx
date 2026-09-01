import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";
import { surface } from "./tokens";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  level?: 1 | 2 | 3;
  interactive?: boolean;
};

/** Solar OS v2 card surface. */
export function DsCard({ level = 1, interactive, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        surface(level),
        "p-6",
        interactive &&
          "cursor-pointer transition-shadow duration-[var(--dur-base)] hover:shadow-[var(--shadow-md)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function DsCardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-display text-[17px] font-semibold leading-tight text-foreground">
          {title}
        </h3>
        {subtitle ? <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function DsCardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-4 flex items-center justify-end gap-2", className)}>{children}</div>
  );
}
