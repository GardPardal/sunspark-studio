import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { LizChat } from "@/components/liz-chat";
import { cn } from "@/lib/utils";

/**
 * Global floating "copilot" button. Sits above the bottom nav on mobile.
 * Uses the existing LizChat in internal mode.
 */
export function LizFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar LIZ" : "Abrir LIZ"}
        className={cn(
          "fixed right-4 z-[70] grid h-14 w-14 place-items-center rounded-full shadow-lg transition-transform",
          "bottom-[calc(72px+env(safe-area-inset-bottom)+12px)] md:bottom-6",
          "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground",
          "hover:scale-105 active:scale-95",
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {open && (
        <div
          className={cn(
            "fixed right-3 z-[69] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border/60 bg-background shadow-2xl",
            "bottom-[calc(72px+env(safe-area-inset-bottom)+80px)] md:bottom-24",
            "h-[min(520px,calc(100vh-180px))]",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-border/60 px-3 py-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">LIZ · Copiloto</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">time interno</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <LizChat mode="internal" inline className="h-full" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
