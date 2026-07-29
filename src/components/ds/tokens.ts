import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Solar OS v2 — Semantic intent tokens.
 * Consumed by all v2 primitives. Never accept raw colors.
 */
export type Intent = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "accent";
export type Emphasis = "solid" | "soft" | "outline" | "ghost";
export type Size = "sm" | "md" | "lg";

export const intentBg: Record<Intent, string> = {
  neutral: "bg-muted text-foreground",
  primary: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-danger text-danger-foreground",
  info: "bg-info text-info-foreground",
  accent: "bg-accent text-accent-foreground",
};

export const intentSoft: Record<Intent, string> = {
  neutral: "bg-muted/60 text-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-[color:oklch(0.35_0.10_60)]",
  danger: "bg-danger/12 text-danger",
  info: "bg-info/12 text-info",
  accent: "bg-accent/60 text-accent-foreground",
};

export const intentOutline: Record<Intent, string> = {
  neutral: "border border-border text-foreground bg-transparent",
  primary: "border border-primary/40 text-primary bg-transparent",
  success: "border border-success/40 text-success bg-transparent",
  warning: "border border-warning/50 text-[color:oklch(0.35_0.10_60)] bg-transparent",
  danger: "border border-danger/40 text-danger bg-transparent",
  info: "border border-info/40 text-info bg-transparent",
  accent: "border border-accent-foreground/20 text-accent-foreground bg-transparent",
};

export const intentDot: Record<Intent, string> = {
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  accent: "bg-accent-foreground",
};

/** Common tone resolver */
export function toneClass(intent: Intent, emphasis: Emphasis): string {
  if (emphasis === "solid") return intentBg[intent];
  if (emphasis === "soft") return intentSoft[intent];
  if (emphasis === "outline") return intentOutline[intent];
  return "text-foreground hover:bg-muted"; // ghost
}

export type WithClassName = { className?: string };
export type WithChildren = { children?: ReactNode };

/** Shared "surface" container className. */
export function surface(level: 1 | 2 | 3 = 1) {
  const map = {
    1: "bg-surface",
    2: "bg-surface-2",
    3: "bg-surface-3",
  } as const;
  return cn("rounded-2xl border border-border/60", map[level]);
}
