import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { DsButton } from "./button";
import type { Intent } from "./tokens";

type Props = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** The single primary action. Solar OS rule: empty states always offer 1 CTA. */
  actionLabel?: string;
  onAction?: () => void;
  actionIntent?: Intent;
  className?: string;
};

export function DsEmpty({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIntent = "primary",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="font-display text-[16px] font-semibold text-foreground">{title}</div>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <DsButton className="mt-4" intent={actionIntent} size="md" onClick={onAction}>
          {actionLabel}
        </DsButton>
      ) : null}
    </div>
  );
}
