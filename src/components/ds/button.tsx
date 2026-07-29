import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { type Intent, type Emphasis, type Size, toneClass } from "./tokens";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  intent?: Intent;
  emphasis?: Emphasis;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
};

const sizeCls: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl min-h-[44px]",
};

/**
 * Solar OS v2 button. Semantic props only — no colors.
 * Use `size="lg"` for the single primary action of a screen.
 */
export const DsButton = forwardRef<HTMLButtonElement, Props>(function DsButton(
  {
    intent = "neutral",
    emphasis = "solid",
    size = "md",
    leadingIcon,
    trailingIcon,
    loading,
    fullWidth,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold tracking-tight transition-[background-color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "active:translate-y-px",
        sizeCls[size],
        toneClass(intent, emphasis),
        emphasis === "solid" && "shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
        emphasis === "soft" && "hover:brightness-95",
        emphasis === "outline" && "hover:bg-muted/40",
        emphasis === "ghost" && "hover:bg-muted/60",
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});
