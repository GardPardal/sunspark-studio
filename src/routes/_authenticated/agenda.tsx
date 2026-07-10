import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2, Check, X, Clock, AlertCircle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { syncMyAppointmentsToGoogleCalendar } from "@/lib/google-calendar.functions";

import {
  listAppointments,
  createAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  getMyAvailability,
  setAvailability,
  listFreeSlots,
} from "@/lib/agenda.functions";
import { listCrmLeads } from "@/lib/crm.functions";
import { BackendTopBar } from "@/components/backend-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — LZ7 Consultor" },
      { name: "description", content: "Sua agenda de compromissos LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AgendaPage,
});

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TYPES = [
  { value: "ligacao", label: "Ligação" },
  { value: "visita_tecnica", label: "Visita técnica" },
  { value: "reuniao", label: "Reunião" },
  { value: "outro", label: "Outro" },
] as const;

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long" });
}
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function ymdLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function AgendaPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAppointments);
  const createFn = useServerFn(createAppointment);
  const updateFn = useServerFn(updateAppointmentStatus);
  const delFn = useServerFn(deleteAppointment);
  const availFn = useServerFn(getMyAvailability);
  const setAvailFn = useServerFn(setAvailability);
  const leadsFn = useServerFn(listCrmLeads);
  const freeSlotsFn = useServerFn(listFreeSlots);

  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const rangeFrom = useMemo(() => {
    const d = new Date(monthCursor); d.setDate(d.getDate() - 7); return d.toISOString();
  }, [monthCursor]);
  const rangeTo = useMemo(() => {
    const d = new Date(monthCursor); d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() + 14); return d.toISOString();
  }, [monthCursor]);

  const apptsQ = useQuery({
    queryKey: ["agenda_appts", rangeFrom, rangeTo],
    queryFn: () => listFn({ data: { from: rangeFrom, to: rangeTo } }) as any,
    refetchInterval: 30_000,
  });
  const availQ = useQuery({ queryKey: ["agenda_avail"], queryFn: () => availFn({ data: {} }) as any });
  const leadsQ = useQuery({ queryKey: ["crm_leads"], queryFn: () => leadsFn() as any });


  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "ligacao" as (typeof TYPES)[number]["value"],
    leadId: "" as string,
    startsAt: toLocalInput(new Date(Date.now() + 3600_000).toISOString()),
    endsAt: toLocalInput(new Date(Date.now() + 7200_000).toISOString()),
    notes: "",
  });

  // Preview de slots livres para o dia selecionado
  const dayFrom = useMemo(() => {
    const d = new Date(form.startsAt);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [form.startsAt]);
  const dayTo = useMemo(() => {
    const d = new Date(form.startsAt);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }, [form.startsAt]);

  const freeQ = useQuery({
    enabled: open && !!form.startsAt,
    queryKey: ["agenda_free", dayFrom, dayTo],
    queryFn: () => freeSlotsFn({ data: { userId: undefined as any, from: dayFrom, to: dayTo, slotMinutes: 60 } } as any) as any,
  });

  // Validação client-side
  const validationError = useMemo(() => {
    if (!form.title.trim()) return "Informe um título.";
    const s = new Date(form.startsAt).getTime();
    const e = new Date(form.endsAt).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e)) return "Data/hora inválida.";
    if (e <= s) return "O horário final deve ser depois do início.";
    if (s < Date.now() - 60_000) return "Não é possível marcar no passado.";
    const appts = (apptsQ.data as any[]) ?? [];
    const conflict = appts.find(
      (a) => a.status === "agendado" && new Date(a.starts_at).getTime() < e && new Date(a.ends_at).getTime() > s,
    );
    if (conflict) return `Conflito com "${conflict.title}" às ${fmtDateTime(conflict.starts_at)}.`;
    return null;
  }, [form, apptsQ.data]);

  const freeSlots = (freeQ.data as { slot_start: string; slot_end: string }[] | undefined) ?? [];
  const noSlotsForDay = freeQ.isSuccess && freeSlots.length === 0;

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          title: form.title,
          type: form.type,
          leadId: form.leadId || null,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          notes: form.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Compromisso criado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["agenda_appts"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("conflito")) {
        toast.error("Conflito de horário: você já tem outro compromisso nesse intervalo.");
      } else if (msg.includes("permissão")) {
        toast.error("Você não tem permissão para marcar nessa agenda.");
      } else {
        toast.error(msg || "Não foi possível salvar o compromisso.");
      }
    },
  });


  const grouped = useMemo(() => {
    const list = (apptsQ.data as any[]) ?? [];
    const map = new Map<string, any[]>();
    for (const a of list) {
      const day = ymdLocal(new Date(a.starts_at));
      if (selectedDay && day !== selectedDay) continue;
      const arr = map.get(day) ?? [];
      arr.push(a);
      map.set(day, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [apptsQ.data, selectedDay]);

  // Contagem por dia (para os pontinhos no calendário)
  const countByDay = useMemo(() => {
    const list = (apptsQ.data as any[]) ?? [];
    const map = new Map<string, number>();
    for (const a of list) {
      if (a.status === "cancelado") continue;
      const day = ymdLocal(new Date(a.starts_at));
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return map;
  }, [apptsQ.data]);

  const leadOptions = ((leadsQ.data as any[]) ?? []).slice(0, 200);


  return (
    <div className="min-h-screen bg-secondary/30">
      <BackendTopBar title="Minha agenda" subtitle="Compromissos e disponibilidade" />

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            {grouped.reduce((s, [, arr]) => s + arr.length, 0)} compromissos próximos
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo compromisso</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={form.leadId || "none"} onValueChange={(v) => setForm({ ...form, leadId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Lead (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sem lead —</SelectItem>
                    {leadOptions.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} · {l.cidade ?? ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">Início<Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
                  <label className="text-xs">Fim<Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label>
                </div>
                <Textarea placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

                {/* Preview de slots livres */}
                <div className="rounded-lg border bg-muted/30 p-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Horários livres no dia
                  </div>
                  {freeQ.isLoading && <div className="text-xs text-muted-foreground">Carregando…</div>}
                  {noSlotsForDay && (
                    <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Nenhum slot livre nesse dia. Ajuste sua disponibilidade abaixo ou escolha outro dia.</span>
                    </div>
                  )}
                  {freeSlots.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {freeSlots.slice(0, 12).map((s) => (
                        <button
                          key={s.slot_start}
                          type="button"
                          className="rounded-md border bg-background px-2 py-1 text-[11px] hover:bg-accent"
                          onClick={() =>
                            setForm({
                              ...form,
                              startsAt: toLocalInput(s.slot_start),
                              endsAt: toLocalInput(s.slot_end),
                            })
                          }
                        >
                          {new Date(s.slot_start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {validationError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button disabled={!!validationError || create.isPending} onClick={() => create.mutate()}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <MonthCalendar
          cursor={monthCursor}
          setCursor={setMonthCursor}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          countByDay={countByDay}
          onNewAt={(ymd) => {
            const startD = new Date(`${ymd}T09:00`);
            const endD = new Date(`${ymd}T10:00`);
            setForm({
              ...form,
              startsAt: toLocalInput(startD.toISOString()),
              endsAt: toLocalInput(endD.toISOString()),
            });
            setOpen(true);
          }}
        />

        {grouped.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {selectedDay
              ? "Nenhum compromisso nesse dia. Clique em qualquer dia livre para marcar."
              : "Nenhum compromisso. Defina sua disponibilidade abaixo para receber agendamentos."}
          </div>
        )}


        {grouped.map(([day, items]) => (
          <section key={day}>
            <h3 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{fmtDate(items[0].starts_at)}</h3>
            <div className="space-y-2">
              {items.map((a) => (
                <div key={a.id} className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", a.status === "cancelado" && "opacity-50")}>
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(a.starts_at)} · {a.type}</div>
                    {a.notes && <div className="text-xs text-muted-foreground truncate">{a.notes}</div>}
                  </div>
                  {a.status === "agendado" && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => updateFn({ data: { id: a.id, status: "concluido" } }).then(() => qc.invalidateQueries({ queryKey: ["agenda_appts"] }))}>
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => updateFn({ data: { id: a.id, status: "cancelado" } }).then(() => qc.invalidateQueries({ queryKey: ["agenda_appts"] }))}>
                        <X className="h-4 w-4 text-amber-600" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => delFn({ data: { id: a.id } }).then(() => qc.invalidateQueries({ queryKey: ["agenda_appts"] }))}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))}

        <AvailabilityCard
          value={(availQ.data as any[]) ?? []}
          onSave={async (windows) => {
            await setAvailFn({ data: { windows } });
            toast.success("Disponibilidade salva");
            qc.invalidateQueries({ queryKey: ["agenda_avail"] });
          }}
        />
      </main>
    </div>
  );
}

function AvailabilityCard({ value, onSave }: { value: any[]; onSave: (w: any[]) => Promise<void> }) {
  const [windows, setWindows] = useState<any[]>(value);
  // sincroniza quando data chega
  useMemoSync(value, setWindows);

  function add(day: number) {
    setWindows((w) => [...w, { weekday: day, start_time: "08:00", end_time: "18:00" }]);
  }
  function rm(idx: number) { setWindows((w) => w.filter((_, i) => i !== idx)); }
  function upd(idx: number, patch: any) { setWindows((w) => w.map((x, i) => (i === idx ? { ...x, ...patch } : x))); }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <h3 className="font-display font-semibold mb-2">Meus horários disponíveis</h3>
      <p className="text-xs text-muted-foreground mb-3">Janelas semanais em que SDR/coord podem agendar com você.</p>
      <div className="space-y-2">
        {DAYS.map((label, day) => (
          <div key={day} className="rounded-lg border p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{label}</span>
              <Button size="sm" variant="ghost" onClick={() => add(day)}><Plus className="h-3 w-3" /></Button>
            </div>
            {windows.filter((w) => w.weekday === day).map((w) => {
              const idx = windows.indexOf(w);
              return (
                <div key={idx} className="mt-1 flex items-center gap-2">
                  <Input type="time" className="w-28" value={w.start_time.slice(0, 5)} onChange={(e) => upd(idx, { start_time: e.target.value })} />
                  <span>—</span>
                  <Input type="time" className="w-28" value={w.end_time.slice(0, 5)} onChange={(e) => upd(idx, { end_time: e.target.value })} />
                  <Button size="icon" variant="ghost" onClick={() => rm(idx)}><Trash2 className="h-3 w-3 text-red-600" /></Button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <Button className="mt-3 w-full" onClick={() => onSave(windows)}>Salvar disponibilidade</Button>
    </section>
  );
}

function useMemoSync(value: any[], setter: (v: any[]) => void) {
  const [ref, setRef] = useState<string>("");
  const cur = JSON.stringify(value);
  if (ref !== cur) {
    setRef(cur);
    setter(value);
  }
}

const MONTH_LABEL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_SHORT = ["D","S","T","Q","Q","S","S"];

function MonthCalendar({
  cursor, setCursor, selectedDay, setSelectedDay, countByDay, onNewAt,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  selectedDay: string | null;
  setSelectedDay: (d: string | null) => void;
  countByDay: Map<string, number>;
  onNewAt: (ymd: string) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = first.getDay(); // 0=dom
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const todayYmd = (() => {
    const t = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  })();

  const cells: (null | { day: number; ymd: string })[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const pad = (n: number) => String(n).padStart(2, "0");
    cells.push({ day: d, ymd: `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(d)}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = () => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); };
  const next = () => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); };
  const today = () => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
    setCursor(d); setSelectedDay(todayYmd);
  };

  return (
    <section className="rounded-2xl border bg-card p-3 shadow-sm">
      <header className="flex items-center justify-between gap-2 pb-2">
        <Button variant="ghost" size="icon" onClick={prev} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-semibold">{MONTH_LABEL[cursor.getMonth()]} {cursor.getFullYear()}</h3>
          <button type="button" onClick={today} className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide hover:bg-accent">
            Hoje
          </button>
          {selectedDay && (
            <button type="button" onClick={() => setSelectedDay(null)} className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide hover:bg-accent">
              Todos
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={next} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
      </header>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {DAYS_SHORT.map((d, i) => <div key={i} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="aspect-square" />;
          const count = countByDay.get(c.ymd) ?? 0;
          const isToday = c.ymd === todayYmd;
          const isSelected = c.ymd === selectedDay;
          const isPast = c.ymd < todayYmd;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : c.ymd)}
              onDoubleClick={() => onNewAt(c.ymd)}
              className={cn(
                "relative aspect-square rounded-lg text-sm font-medium transition flex flex-col items-center justify-center",
                isSelected ? "bg-primary text-primary-foreground shadow-sm"
                  : isToday ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "bg-background hover:bg-accent",
                isPast && !isSelected && "text-muted-foreground/60",
              )}
              title={count ? `${count} compromisso${count > 1 ? "s" : ""} — duplo-clique para novo` : "Duplo-clique para novo compromisso"}
            >
              <span>{c.day}</span>
              {count > 0 && (
                <span className={cn(
                  "mt-0.5 min-w-[16px] rounded-full px-1 text-[9px] font-bold leading-[14px]",
                  isSelected ? "bg-primary-foreground/25 text-primary-foreground" : "bg-primary/15 text-primary",
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Toque num dia para filtrar. Duplo-clique para criar às 9h.</p>
    </section>
  );
}
