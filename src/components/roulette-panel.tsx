import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dices, Sparkles, Users2, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  listConsultantsByUnit,
  spinRoulette,
  spinVisitaTecnica,
  countTrafficQueue,
} from "@/lib/roulette.functions";

const UNITS = [
  { key: "londrina", label: "Londrina" },
  { key: "ponta_grossa", label: "Ponta Grossa" },
  { key: "wenceslau_braz", label: "Wenceslau Braz" },
] as const;

type Mode = "orcamento" | "visita_tecnica";

export function RoulettePanel() {
  return (
    <Tabs defaultValue="orcamento" className="w-full">
      <TabsList>
        <TabsTrigger value="orcamento"><Dices className="h-3.5 w-3.5 mr-1" /> Orçamento</TabsTrigger>
        <TabsTrigger value="visita_tecnica"><Wrench className="h-3.5 w-3.5 mr-1" /> Visita técnica</TabsTrigger>
      </TabsList>
      <TabsContent value="orcamento" className="mt-4"><SpinCard mode="orcamento" /></TabsContent>
      <TabsContent value="visita_tecnica" className="mt-4"><SpinCard mode="visita_tecnica" /></TabsContent>
    </Tabs>
  );
}

function SpinCard({ mode }: { mode: Mode }) {
  const qc = useQueryClient();
  const [unit, setUnit] = useState<(typeof UNITS)[number]["key"]>("londrina");
  const [count, setCount] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<{ distributed: number } | null>(null);

  const listFn = useServerFn(listConsultantsByUnit);
  const countFn = useServerFn(countTrafficQueue);
  const spinOrcFn = useServerFn(spinRoulette);
  const spinVisitaFn = useServerFn(spinVisitaTecnica);

  const consultantsQ = useQuery({
    queryKey: ["roulette-consultants", unit],
    queryFn: () => listFn({ data: { unit } }),
  });
  const queueQ = useQuery({
    queryKey: ["traffic-queue-count"],
    queryFn: () => countFn(),
    refetchInterval: 20000,
  });

  const spinM = useMutation({
    mutationFn: () =>
      mode === "orcamento"
        ? spinOrcFn({ data: { unit, count } })
        : spinVisitaFn({ data: { unit, count } }),
    onMutate: () => setSpinning(true),
    onSuccess: (res) => {
      setLastResult(res);
      const label = UNITS.find((u) => u.key === unit)?.label;
      toast.success(`${res.distributed} lead(s) distribuído(s) para ${label}. Pode reatribuir manualmente no Kanban se precisar.`);
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      qc.invalidateQueries({ queryKey: ["traffic-queue-count"] });
      setTimeout(() => setSpinning(false), 1200);
    },
    onError: (e: Error) => { toast.error(e.message); setSpinning(false); },
  });

  const consultants = consultantsQ.data ?? [];
  const queueCount = mode === "orcamento" ? (queueQ.data?.count ?? 0) : (queueQ.data?.visitaCount ?? 0);
  const isVisita = mode === "visita_tecnica";

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        {isVisita ? <Wrench className="h-5 w-5 text-primary" /> : <Dices className="h-5 w-5 text-primary" />}
        <h3 className="text-lg font-semibold">
          {isVisita ? "Distribuição de visitas técnico-comerciais" : "Roleta SDR — distribuição de orçamentos"}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {isVisita
          ? "Sorteia leads marcados como Visita técnica entre os consultores da unidade. Depois do sorteio, você pode reatribuir manualmente pelo Kanban se precisar."
          : "Sorteia leads de tráfego da fila comum para os consultores da unidade. Leads offline e de visita técnica não entram aqui."}
      </p>

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <div>
          <Label>Unidade</Label>
          <Select value={unit} onValueChange={(v) => setUnit(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Quantos leads distribuir</Label>
          <Input type="number" min={1} max={Math.max(queueCount, 1)} value={count} onChange={(e) => setCount(Math.max(1, parseInt(e.target.value || "1", 10)))} />
        </div>
        <div className="flex items-end">
          <Button className="w-full" disabled={spinning || consultants.length === 0 || queueCount === 0} onClick={() => spinM.mutate()}>
            <Dices className={`h-4 w-4 mr-2 ${spinning ? "animate-spin" : ""}`} />
            {spinning ? "Girando..." : isVisita ? "Sortear visitas" : "Girar Roleta"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-3 bg-secondary/30">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            {isVisita ? "Fila de visitas" : "Fila de tráfego"}
          </div>
          <div className="text-2xl font-bold text-primary">{queueCount}</div>
          <div className="text-xs text-muted-foreground">lead(s) esperando distribuição</div>
        </Card>
        <Card className="p-3 bg-secondary/30">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
            <Users2 className="h-3 w-3" /> Consultores ativos ({UNITS.find((u) => u.key === unit)?.label})
          </div>
          <div className="text-2xl font-bold">{consultants.length}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {consultants.map((c: any) => (
              <Badge key={c.id} variant={spinning ? "default" : "outline"} className={spinning ? "animate-pulse" : ""}>{c.name}</Badge>
            ))}
            {consultants.length === 0 && <span className="text-xs text-muted-foreground">Nenhum consultor ativo nesta unidade.</span>}
          </div>
        </Card>
      </div>

      {lastResult && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Sparkles className="h-4 w-4 inline text-primary mr-1" />
          Último giro: <strong>{lastResult.distributed}</strong> lead(s) distribuído(s).
        </div>
      )}
    </Card>
  );
}
