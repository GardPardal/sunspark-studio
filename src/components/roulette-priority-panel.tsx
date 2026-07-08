import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, ArrowDown, Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { listConsultantsByUnit, setConsultantPriority } from "@/lib/roulette.functions";

const UNITS = [
  { key: "londrina", label: "Londrina" },
  { key: "ponta_grossa", label: "Ponta Grossa" },
  { key: "wenceslau_braz", label: "Wenceslau Braz" },
] as const;

type Row = { id: string; name: string; priority: number };

export function RoulettePriorityPanel() {
  const qc = useQueryClient();
  const [unit, setUnit] = useState<(typeof UNITS)[number]["key"]>("londrina");
  const [rows, setRows] = useState<Row[]>([]);

  const listFn = useServerFn(listConsultantsByUnit);
  const setFn = useServerFn(setConsultantPriority);

  const q = useQuery({
    queryKey: ["roulette-priority", unit],
    queryFn: () => listFn({ data: { unit } }),
  });

  useEffect(() => {
    if (q.data) setRows((q.data as Row[]).slice().sort((a, b) => a.priority - b.priority));
  }, [q.data]);

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setRows(next);
  };

  const saveM = useMutation({
    mutationFn: async () => {
      // Prioridade sequencial (10, 20, 30…) para deixar espaço se quiser inserir depois
      for (let i = 0; i < rows.length; i++) {
        await setFn({ data: { userId: rows[i].id, priority: (i + 1) * 10 } });
      }
    },
    onSuccess: () => {
      toast.success("Ranking salvo. O consultor no topo recebe o primeiro lead.");
      qc.invalidateQueries({ queryKey: ["roulette-priority"] });
      qc.invalidateQueries({ queryKey: ["roulette-consultants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Ranking de prioridade da roleta</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Organize a ordem de recebimento dos leads. Regra da casa: <strong>consultor mais antigo recebe primeiro</strong>.
        Use as setas para reorganizar e clique em <em>Salvar ranking</em>. A distribuição segue essa ordem em rodízio (1º, 2º, 3º… e recomeça).
      </p>

      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <div>
          <Label>Unidade</Label>
          <Select value={unit} onValueChange={(v) => setUnit(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex items-end justify-end">
          <Button onClick={() => saveM.mutate()} disabled={saveM.isPending || rows.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {saveM.isPending ? "Salvando..." : "Salvar ranking"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
            Nenhum consultor ativo nesta unidade.
          </div>
        )}
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
            <Badge variant={i === 0 ? "default" : "outline"} className="w-8 justify-center">{i + 1}º</Badge>
            <div className="flex-1">
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                {i === 0 ? "Recebe primeiro" : `${i}ª posição depois do topo`}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
