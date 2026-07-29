import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTimeline, type TimelineEvent } from "@/lib/solar-os.functions";
import { DsCard } from "@/components/ds";
import { DsSkeletonList } from "@/components/ds/skeleton";
import {
  Activity,
  Phone,
  MessageSquare,
  CalendarClock,
  Mail,
  ArrowRightLeft,
  Sparkles,
  UserPlus,
  DollarSign,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, { Icon: typeof Activity; tone: string }> = {
  call: { Icon: Phone, tone: "text-blue-600 bg-blue-500/10" },
  whatsapp: { Icon: MessageSquare, tone: "text-green-600 bg-green-500/10" },
  email: { Icon: Mail, tone: "text-sky-600 bg-sky-500/10" },
  meeting: { Icon: CalendarClock, tone: "text-fuchsia-600 bg-fuchsia-500/10" },
  stage_change: { Icon: ArrowRightLeft, tone: "text-primary bg-primary/10" },
  form_submit: { Icon: UserPlus, tone: "text-amber-600 bg-amber-500/10" },
  ai_action: { Icon: Sparkles, tone: "text-purple-600 bg-purple-500/10" },
  sale: { Icon: DollarSign, tone: "text-emerald-700 bg-emerald-500/10" },
  workflow: { Icon: Zap, tone: "text-orange-600 bg-orange-500/10" },
};

function iconFor(kind: string) {
  return KIND_ICON[kind] ?? { Icon: Activity, tone: "text-muted-foreground bg-muted" };
}

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function Timeline({
  entityType,
  entityId,
  title = "Timeline",
  limit = 50,
}: {
  entityType: string;
  entityId: string;
  title?: string;
  limit?: number;
}) {
  const fetchFn = useServerFn(getTimeline);
  const q = useQuery({
    queryKey: ["timeline", entityType, entityId, limit],
    queryFn: () => fetchFn({ data: { entity_type: entityType, entity_id: entityId, limit } }) as Promise<TimelineEvent[]>,
    refetchInterval: 30_000,
  });

  return (
    <DsCard>
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {q.data?.length ?? 0} eventos
        </span>
      </div>
      <div className="p-4">
        {q.isLoading ? (
          <DsSkeletonList rows={4} />
        ) : !q.data?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <ol className="relative space-y-4 pl-6 before:absolute before:left-2 before:top-1 before:h-full before:w-px before:bg-border">
            {q.data.map((ev) => {
              const { Icon, tone } = iconFor(ev.kind);
              return (
                <li key={ev.id} className="relative">
                  <span className={cn("absolute -left-6 grid h-5 w-5 place-items-center rounded-full ring-2 ring-background", tone)}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{ev.title}</p>
                    <time className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {formatTs(ev.ts)}
                    </time>
                  </div>
                  {ev.summary && <p className="text-[12px] text-muted-foreground">{ev.summary}</p>}
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {ev.source} {ev.actor_name ? `· ${ev.actor_name}` : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </DsCard>
  );
}
