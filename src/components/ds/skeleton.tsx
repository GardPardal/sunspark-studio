import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Preset shapes so callers don't reinvent skeletons. */
  variant?: "text" | "line" | "block" | "avatar" | "card";
};

/**
 * Solar OS v2 — Skeleton with shimmer.
 * Prefer this over spinners for initial page loads.
 */
export function DsSkeleton({ className, variant = "line" }: Props) {
  const base = "ds-shimmer rounded-md";
  const variants = {
    text: "h-3 w-full",
    line: "h-4 w-full",
    block: "h-24 w-full rounded-xl",
    avatar: "h-10 w-10 rounded-full",
    card: "h-40 w-full rounded-2xl",
  } as const;
  return <div aria-hidden className={cn(base, variants[variant], className)} />;
}

export function DsSkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <DsSkeleton key={i} variant="line" />
      ))}
    </div>
  );
}
