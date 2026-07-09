import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2, Check, X, Clock } from "lucide-react";
import {
  listAppointments,
  createAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  getMyAvailability,
  setAvailability,
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

function AgendaPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAppointments);
  const createFn = useServerFn(createAppointment);
  const updateFn = useServerFn(updateAppointmentStatus);
  const delFn = useServerFn(deleteAppointment);
  const availFn = useServerFn(getMyAvailability);
  const setAvailFn = useServerFn(setAvailability);
  const leadsFn = useServerFn(listCrmLeads);

  const apptsQ = useQuery({
    queryKey: ["agenda_appts"],
    queryFn: () => listFn({ data: {} }) as any,
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
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const grouped = useMemo(() => {
    const list = (apptsQ.data as any[]) ?? [];
    const map = new Map<string, any[]>();
    for (const a of list) {
      const day = new Date(a.starts_at).toISOString().slice(0, 10);
      const arr = map.get(day) ?? [];
      arr.push(a);
      map.set(day, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
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
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button disabled={!form.title || create.isPending} onClick={() => create.mutate()}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {grouped.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum compromisso. Defina sua disponibilidade abaixo para receber agendamentos.
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
