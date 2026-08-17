import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle, Phone, Clock, MapPin, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { registerInteraction, adiarProximaAcao } from "./clientes.functions";
import { OUTCOMES, STAGE_LABEL, type ClienteRow } from "./shared";

export const STAGE_TONE: Record<string, string> = {
  novo: "bg-primary/12 text-primary",
  atendimento: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  nao_atendido: "bg-red-500/12 text-red-700 dark:text-red-400",
  venda: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  faturado: "bg-emerald-600/20 text-emerald-800 dark:text-emerald-300",
  perdido: "bg-muted text-muted-foreground",
};

export function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

export function waLink(telefone: string, nome?: string) {
  const d = onlyDigits(telefone);
  const full = d.length <= 11 ? `55${d}` : d;
  const msg = encodeURIComponent(`Olá${nome ? ` ${nome.split(" ")[0]}` : ""}! Aqui é da LZ7 Energia.`);
  return `https://wa.me/${full}?text=${msg}`;
}

export function relTime(iso?: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const label = m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
  return diff >= 0 ? `há ${label}` : `em ${label}`;
}

export function QuickActions({ cliente, size = "sm" }: { cliente: { telefone: string; nome: string }; size?: "sm" | "default" }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size={size} className="gap-1.5">
        <a href={waLink(cliente.telefone, cliente.nome)} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      </Button>
      <Button asChild size={size} variant="secondary" className="gap-1.5">
        <a href={`tel:${onlyDigits(cliente.telefone)}`}>
          <Phone className="h-4 w-4" /> Ligar
        </a>
      </Button>
    </div>
  );
}

/** Diálogo curto "O que aconteceu?" — dispara as regras de etapa já existentes. */
export function InteractionDialog({
  open,
  onOpenChange,
  cliente,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: { id: string; nome: string } | null;
}) {
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saleValue, setSaleValue] = useState("");
  const qc = useQueryClient();
  const register = useServerFn(registerInteraction);

  const mut = useMutation({
    mutationFn: () =>
      register({
        data: {
          leadId: cliente!.id,
          outcome: outcome!,
          note,
          saleValue: outcome === "venda" && saleValue ? Number(saleValue.replace(/\./g, "").replace(",", ".")) : null,
        },
      }) as any,
    onSuccess: (r: any) => {
      toast.success("Interação registrada", { description: r?.next ? `Próxima ação: ${r.next}` : undefined });
      qc.invalidateQueries({ queryKey: ["today_board"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["cliente", cliente?.id] });
      setOutcome(null); setNote(""); setSaleValue("");
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast.error("Não foi possível concluir esta ação.", { description: e?.message ?? undefined }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">O que aconteceu?</DialogTitle>
          <DialogDescription>{cliente?.nome}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {OUTCOMES.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setOutcome(o.key)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left text-[13px] font-semibold transition",
                outcome === o.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/60",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {outcome === "venda" && (
          <Input
            inputMode="decimal"
            placeholder="Valor da venda (R$)"
            value={saleValue}
            onChange={(e) => setSaleValue(e.target.value)}
          />
        )}

        <Textarea
          placeholder="Observação (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />

        <Button
          size="lg"
          disabled={!outcome || mut.isPending}
          onClick={() => mut.mutate()}
          className="w-full"
        >
          {mut.isPending ? "Salvando..." : "Salvar interação"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function SnoozeButton({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const adiar = useServerFn(adiarProximaAcao);
  const mut = useMutation({
    mutationFn: () => adiar({ data: { leadId, hours: 24 } }) as any,
    onSuccess: () => {
      toast.success("Próxima ação adiada para amanhã");
      qc.invalidateQueries({ queryKey: ["today_board"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: any) => toast.error("Não foi possível adiar.", { description: e?.message }),
  });
  return (
    <Button variant="ghost" size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
      <Clock className="mr-1.5 h-4 w-4" /> Adiar
    </Button>
  );
}

/** Card único de cliente — usado em /hoje e /clientes (mobile-first). */
export function ClienteCard({
  c,
  onRegister,
  highlight,
}: {
  c: ClienteRow;
  onRegister: (c: ClienteRow) => void;
  highlight?: boolean;
}) {
  const late = c.urgency >= 85;
  return (
    <Card className={cn("p-4 transition hover:shadow-md", highlight && late && "ring-1 ring-red-500/30")}>
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/clientes/$id"
          params={{ id: c.id }}
          className="min-w-0 flex-1 group"
        >
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[15px] font-semibold group-hover:text-primary">{c.nome}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {c.cidade && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {c.cidade}
              </span>
            )}
            {c.valor_conta && <span>Conta: {c.valor_conta}</span>}
            {c.origem && <span>· {c.origem}</span>}
          </div>
        </Link>
        <Badge className={cn("shrink-0 border-0 text-[10px] font-bold uppercase", STAGE_TONE[c.stage] ?? "")}>
          {STAGE_LABEL[c.stage] ?? c.stage}
        </Badge>
      </div>

      {c.next_action && (
        <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Próxima ação</div>
          <div className="text-sm font-semibold">{c.next_action}</div>
          {c.next_action_at && (
            <div className="text-xs text-muted-foreground">{relTime(c.next_action_at)}</div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <QuickActions cliente={c} />
        <div className="flex items-center gap-1">
          <SnoozeButton leadId={c.id} />
          <Button size="sm" variant="secondary" onClick={() => onRegister(c)} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Registrar
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 p-8 text-center">
      <div className="font-display text-base font-semibold">{title}</div>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </Card>
  );
}
