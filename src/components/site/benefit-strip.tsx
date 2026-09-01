import { Coins, Leaf, ShieldCheck, TrendingUp } from "lucide-react";
import { BENEFITS } from "./home-content";

const icons = { leaf: Leaf, trend: TrendingUp, shield: ShieldCheck, coins: Coins } as const;

export function BenefitStrip() {
  return (
    <section id="vantagens" className="relative bg-white">
      <div className="mx-auto max-w-[1320px] px-4 md:px-8">
        <div className="-mt-8 grid grid-cols-2 gap-x-4 gap-y-6 rounded-2xl bg-white p-5 shadow-[0_24px_60px_-32px_oklch(0.2_0.04_248/0.55)] ring-1 ring-black/5 sm:gap-6 md:-mt-14 md:grid-cols-4 md:p-8 lg:-mt-16">
          {BENEFITS.map((item) => {
            const Icon = icons[item.icon];
            return (
              <div key={item.value} className="flex items-start gap-3">
                <Icon
                  className="mt-0.5 h-7 w-7 shrink-0 text-lzgreen"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold leading-tight text-navy-deep sm:text-base">
                    {item.value}
                  </p>
                  <p className="text-xs text-muted-foreground sm:text-sm">{item.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
