import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BackendTopBar,
} from "@/components/backend-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FloatingNotes } from "@/components/solar/floating-notes";
import { cn } from "@/lib/utils";
import {
  Car,
  CheckCircle2,
  Clock,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/lavagens")({
  head: () => ({
    meta: [
      { title: "Controle de Lavagens — LZ7" },
      { name: "description", content: "Controle prático de lavagens de frota com anotações do dia a dia." },
      { property: "og:title", content: "Controle de Lavagens — LZ7" },
      { property: "og:description", content: "Registre e acompanhe lavagens de forma simples." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LavagensPage,
});

type WashStatus = "pendente" | "em_andamento" | "concluida";

type Wash = {
  id: string;
  vehicle: string;
  type: string;
  status: WashStatus;
  responsible: string;
  value: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "lz7_lavagens_v1";

const STATUS_LABEL: Record<WashStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

const STATUS_STYLES: Record<
  WashStatus,
  { bg: string; text: string; ring: string; Icon: typeof Clock }
> = {
  pendente: { bg: "bg-amber-100", text: "text-amber-900", ring: "ring-amber-300/70", Icon: Clock },
  em_andamento: { bg: "bg-sky-100", text: "text-sky-900", ring: "ring-sky-300/70", Icon: Wrench },
  concluida: { bg: "bg-emerald-100", text: "text-emerald-900", ring: "ring-emerald-300/70", Icon: CheckCircle2 },
};

const WASH_TYPES = [
  "Simples",
  "Completa",
  "Cera",
  "Motor",
  "Tapeçaria",
  "Outros",
];

function loadWashes(): Wash[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWashes(list: Wash[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function LavagensPage() {
  const [hydrated, setHydrated] = useState(false);
  const [washes, setWashes] = useState<Wash[]>([]);
  const [formOpen, setFormOpen] = useState(false);

  const [vehicle, setVehicle] = useState("");
  const [type, setType] = useState("Simples");
  const [responsible, setResponsible] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setWashes(loadWashes());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveWashes(washes);
  }, [washes, hydrated]);

  const summary = useMemo(() => {
    const total = washes.length;
    const pending = washes.filter((w) => w.status === "pendente").length;
    const doing = washes.filter((w) => w.status === "em_andamento").length;
    const done = washes.filter((w) => w.status === "concluida").length;
    const revenue = washes
      .filter((w) => w.status === "concluida")
      .reduce((acc, w) => acc + (Number(w.value) || 0), 0);
    return { total, pending, doing, done, revenue };
  }, [washes]);

  const addWash = () => {
    if (!vehicle.trim()) return;
    const now = new Date().toISOString();
    const newWash: Wash = {
      id: crypto.randomUUID(),
      vehicle: vehicle.trim().toUpperCase(),
      type,
      status: "pendente",
      responsible: responsible.trim(),
      value: Number(value.replace(/[^0-9,]/g, "").replace(",", ".")) || 0,
      note: note.trim(),
      createdAt: now,
      updatedAt: now,
    };
    setWashes((prev) => [newWash, ...prev]);
    setVehicle("");
    setType("Simples");
    setResponsible("");
    setValue("");
    setNote("");
    setFormOpen(false);
  };

  const updateStatus = (id: string, status: WashStatus) => {
    setWashes((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, status, updatedAt: new Date().toISOString() } : w,
      ),
    );
  };

  const removeWash = (id: string) => {
    setWashes((prev) => prev.filter((w) => w.id !== id));
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <BackendTopBar title="Lavagens" subtitle="Controle de frota" />
        <main className="mx-auto max-w-4xl px-3 py-4 sm:px-4">
          <div className="h-40 animate-pulse rounded-2xl bg-muted/60" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 pb-28">
      <BackendTopBar title="Lavagens" subtitle="Controle de frota da Maria Bueno" />

      <main className="mx-auto max-w-4xl space-y-4 px-3 py-4 sm:px-4">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Controle de lavagens
          </h1>
          <p className="text-sm text-muted-foreground">
            Registre cada lavagem, acompanhe o status e anote o que precisar.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card className="p-3">
            <div className="font-display text-2xl font-semibold tabular-nums">{summary.total}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total</div>
          </Card>
          <Card className="p-3">
            <div className="font-display text-2xl font-semibold tabular-nums text-amber-600">{summary.pending}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pendentes</div>
          </Card>
          <Card className="p-3">
            <div className="font-display text-2xl font-semibold tabular-nums text-emerald-600">{summary.done}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Concluídas</div>
          </Card>
          <Card className="p-3">
            <div className="font-display text-xl font-semibold tabular-nums">{BRL(summary.revenue)}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Faturado</div>
          </Card>
        </div>

        {!formOpen && (
          <Button
            onClick={() => setFormOpen(true)}
            className="w-full gap-2 rounded-xl py-5 text-sm font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" /> Nova lavagem
          </Button>
        )}

        {formOpen && (
          <Card className="space-y-3 p-4 ring-1 ring-primary/15">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold">Nova lavagem</h2>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setFormOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vehicle">Placa / Veículo</Label>
                <Input
                  id="vehicle"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  placeholder="Ex: ABC-1234"
                  className="uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WASH_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsible">Responsável</Label>
                <Input
                  id="responsible"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  placeholder="Quem vai fazer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="value">Valor (R$)</Label>
                <Input
                  id="value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Observação</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Detalhes extras"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={addWash} disabled={!vehicle.trim()}>
                Salvar lavagem
              </Button>
            </div>
          </Card>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Lavagens</h2>
            {washes.length > 0 && (
              <span className="text-xs text-muted-foreground">{washes.length} registro(s)</span>
            )}
          </div>

          {washes.length === 0 && (
            <Card className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Nenhuma lavagem registrada</p>
                <p className="text-sm text-muted-foreground">
                  Toque em "Nova lavagem" para começar o controle.
                </p>
              </div>
            </Card>
          )}

          <div className="space-y-2.5">
            {washes.map((w) => {
              const st = STATUS_STYLES[w.status];
              return (
                <Card
                  key={w.id}
                  className={cn(
                    "relative overflow-hidden p-4 ring-1 transition hover:shadow-md",
                    st.ring,
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                        st.bg,
                        st.text,
                      )}
                    >
                      <st.Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-semibold">{w.vehicle}</span>
                        <span
                          className={cn(
                            "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            st.bg,
                            st.text,
                          )}
                        >
                          {STATUS_LABEL[w.status]}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{w.type}</span>
                        {w.responsible && <span>• {w.responsible}</span>}
                        {w.value > 0 && <span>• {BRL(w.value)}</span>}
                        <span>• {new Date(w.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {w.note && (
                        <p className="mt-2 text-sm leading-snug text-foreground/90">{w.note}</p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {w.status !== "pendente" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => updateStatus(w.id, "pendente")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Pendente
                          </Button>
                        )}
                        {w.status !== "em_andamento" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => updateStatus(w.id, "em_andamento")}
                          >
                            <Wrench className="h-3.5 w-3.5" /> Em andamento
                          </Button>
                        )}
                        {w.status !== "concluida" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs border-emerald-300/70 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-50"
                            onClick={() => updateStatus(w.id, "concluida")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto h-8 gap-1 text-xs text-rose-600 hover:text-rose-700"
                          onClick={() => removeWash(w.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <footer className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Os dados ficam salvos no dispositivo. Funciona mesmo sem internet.
        </footer>
      </main>

      <FloatingNotes />
    </div>
  );
}
