import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { type Intent, intentSoft } from "./tokens";
import { DsButton } from "./button";

type Props = {
  intent?: Extract<Intent, "success" | "warning" | "danger" | "info">;
  title: ReactNode;
  description?: ReactNode;
  /** Solar OS RULE: every alert has a Resolver button. */
  onResolve?: () => void;
  resolveLabel?: string;
  onDismiss?: () => void;
  className?: string;
  extra?: ReactNode;
};

const ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
} as const;

/**
 * Solar OS v2 — Alert with mandatory Resolver button.
 * Enforces rule #10 of the Blueprint: todo alerta possui botão "Resolver".
 * If no onResolve provided, this is a passive notice and should use DsBadge instead.
 */
export function DsAlert({
  intent = "info",
  title,
  description,
  onResolve,
  resolveLabel = "Resolver",
  onDismiss,
  className,
  extra,
}: Props) {
  const Icon = ICONS[intent];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-2xl p-4",
        intentSoft[intent],
        "border border-current/10",
        className,
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[14px] leading-tight text-foreground">{title}</div>
        {description ? (
          <div className="mt-1 text-[13px] text-muted-foreground">{description}</div>
        ) : null}
        {extra ? <div className="mt-2">{extra}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onResolve ? (
          <DsButton intent={intent} emphasis="solid" size="sm" onClick={onResolve}>
            {resolveLabel}
          </DsButton>
        ) : null}
        {onDismiss ? (
          <DsButton intent="neutral" emphasis="ghost" size="sm" onClick={onDismiss}>
            Ignorar
          </DsButton>
        ) : null}
      </div>
    </div>
  );
}
