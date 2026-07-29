import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { ArrowLeft, Download, Check, Copy, Webhook } from "lucide-react";
import { getMarketingHub, type HubResponse, type HubRow } from "@/lib/marketing-hub.functions";
import {
  getConversionsConfig,
  saveConversionsConfig,
  type ConversionsConfig,
} from "@/lib/conversions-config.functions";
import { BackendTopBar } from "@/components/backend-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/marketing-hub")({
  head: () => ({
    meta: [
      { title: "Hub de Marketing — LZ7" },
      { name: "description", content: "Atribuição de campanhas Meta a leads, qualificados e vendas." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MarketingHubPage,
});

const brl = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const num = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function downloadCSV(rows: HubRow[]) {
  const headers = [
    "Campanha","Gasto","Leads Meta","Leads CRM","Qualificados","Vendas","Receita","CPL","CPL Qualif.","CAC","ROAS",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      [
        `"${r.campaign_name.replace(/"/g, '""')}"`,
        r.spend.toFixed(2),
        r.meta_leads,
        r.crm_leads,
        r.qualified,
        r.sales,
        r.revenue.toFixed(2),
        r.cpl?.toFixed(2) ?? "",
        r.cpl_qualified?.toFixed(2) ?? "",
        r.cac?.toFixed(2) ?? "",
        r.roas?.toFixed(2) ?? "",
      ].join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hub-marketing-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function MarketingHubPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayISO());
  const fetchHub = useServerFn(getMarketingHub);
  const q = useQuery<HubResponse>({
    queryKey: ["marketing_hub", from, to],
    queryFn: () => fetchHub({ data: { from, to } }) as any,
    staleTime: 30_000,
  });

  const data = q.data;

  return (
    <div className="min-h-screen bg-secondary/30 pb-16">
      <BackendTopBar title="Hub de Marketing" subtitle="Atribuição campanha → lead → venda" />
      <main className="mx-auto max-w-6xl px-4 py-4 space-y-5">
        <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">De</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Até</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setFrom(firstOfMonth()); setTo(todayISO()); }}>
              Mês atual
            </Button>
            {data && (
              <Button size="sm" variant="outline" onClick={() => downloadCSV(data.rows)} className="ml-auto gap-1.5">
                <Download className="h-4 w-4" /> CSV
              </Button>
            )}
          </div>
        </Card>

        {q.isLoading && <Card className="p-6 text-sm text-muted-foreground">Carregando…</Card>}
        {q.error && (
          <Card className="p-6 text-sm text-red-600">
            Erro: {(q.error as Error).message}
          </Card>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Gasto" value={brl(data.totals.spend)} />
              <Kpi label="Leads Meta" value={num(data.totals.meta_leads)} />
              <Kpi label="Qualificados" value={num(data.totals.qualified)} />
              <Kpi label="Vendas" value={num(data.totals.sales)} />
              <Kpi label="Receita" value={brl(data.totals.revenue)} tone="emerald" />
              <Kpi label="CPL" value={brl(data.totals.cpl)} />
              <Kpi label="CPL Qualif." value={brl(data.totals.cpl_qualified)} tone="amber" />
              <Kpi label="ROAS" value={data.totals.roas != null ? `${data.totals.roas.toFixed(2)}x` : "—"} tone="emerald" />
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Por campanha</h3>
                <p className="text-xs text-muted-foreground">
                  Matching por nome da campanha Meta ≈ utm_campaign do lead (case-insensitive).
                  Padronize prefixos (ex: <code>[LDR-ONGRID]</code>) para melhorar o pareamento.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Campanha</th>
                      <th className="text-right px-3 py-2">Gasto</th>
                      <th className="text-right px-3 py-2">Leads Meta</th>
                      <th className="text-right px-3 py-2">Leads CRM</th>
                      <th className="text-right px-3 py-2">Qualif.</th>
                      <th className="text-right px-3 py-2">Vendas</th>
                      <th className="text-right px-3 py-2">Receita</th>
                      <th className="text-right px-3 py-2">CPL</th>
                      <th className="text-right px-3 py-2">CPL Qualif.</th>
                      <th className="text-right px-3 py-2">CAC</th>
                      <th className="text-right px-3 py-2">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">
                          Sem gasto no período.
                        </td>
                      </tr>
                    )}
                    {data.rows.map((r) => (
                      <tr key={r.campaign_id ?? r.campaign_name} className="border-t">
                        <td className="px-3 py-2 max-w-[280px] truncate" title={r.campaign_name}>{r.campaign_name}</td>
                        <td className="px-3 py-2 text-right">{brl(r.spend)}</td>
                        <td className="px-3 py-2 text-right">{num(r.meta_leads)}</td>
                        <td className="px-3 py-2 text-right">{num(r.crm_leads)}</td>
                        <td className="px-3 py-2 text-right">{num(r.qualified)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{num(r.sales)}</td>
                        <td className="px-3 py-2 text-right">{brl(r.revenue)}</td>
                        <td className="px-3 py-2 text-right">{brl(r.cpl)}</td>
                        <td className="px-3 py-2 text-right">{brl(r.cpl_qualified)}</td>
                        <td className="px-3 py-2 text-right">{brl(r.cac)}</td>
                        <td className="px-3 py-2 text-right">{r.roas != null ? `${r.roas.toFixed(2)}x` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {data.unmatched_crm_campaigns.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold">Campanhas do CRM sem match no Meta</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Leads recebidos com utm_campaign que não bateu com nenhuma campanha Meta ativa.
                </p>
                <ul className="text-sm space-y-1">
                  {data.unmatched_crm_campaigns.map((u) => (
                    <li key={u.name} className="flex justify-between">
                      <span className="truncate">{u.name}</span>
                      <span className="font-medium">{u.leads}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
        <PloomesCapiPanel />
      </main>
    </div>
  );
}

function PloomesCapiPanel() {
  const fetchCfg = useServerFn(getConversionsConfig);
  const saveCfg = useServerFn(saveConversionsConfig);
  const q = useQuery<ConversionsConfig>({
    queryKey: ["conversions_config"],
    queryFn: () => fetchCfg() as any,
    staleTime: 30_000,
  });
  const [form, setForm] = useState<ConversionsConfig | null>(null);
  useEffect(() => {
    if (q.data && !form) setForm(q.data);
  }, [q.data, form]);
  const m = useMutation({
    mutationFn: (payload: Partial<ConversionsConfig>) => saveCfg({ data: payload }) as any,
    onSuccess: () => toast.success("Configuração salva. Novos cards do Ploomes já disparam com esses nomes."),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/ploomes/webhook`
    : "/api/public/ploomes/webhook";

  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); toast.success("Copiado."); } catch { /* noop */ }
  };

  const set = (k: keyof ConversionsConfig, v: string) =>
    setForm((prev) => ({ ...(prev ?? ({} as ConversionsConfig)), [k]: v }));

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Webhook className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Ploomes → Meta CAPI (Conversão personalizada)</h3>
          <p className="text-xs text-muted-foreground">
            Cada card/oportunidade criado no Ploomes cai aqui como Lead e dispara o evento configurado
            na Meta. Defina abaixo o nome exato da conversão personalizada por etapa.
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          URL do Webhook (cole no Ploomes → Administração → Webhooks, evento "Negócio criado/atualizado")
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate text-xs bg-background rounded px-2 py-1 border">{webhookUrl}</code>
          <Button size="sm" variant="outline" onClick={() => copy(webhookUrl)} className="gap-1">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Opcional: adicione <code>?secret=SEU_SEGREDO</code> na URL e configure a env
          <code> PLOOMES_WEBHOOK_SECRET</code> igual, para bloquear requisições não autorizadas.
        </p>
      </div>

      {form && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Meta Pixel ID" value={form.meta_pixel_id} onChange={(v) => set("meta_pixel_id", v)} placeholder="1234567890" />
            <Field label="Test Event Code (opcional)" value={form.meta_test_event_code} onChange={(v) => set("meta_test_event_code", v)} placeholder="TEST12345" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label='Evento — etapa "novo" (card criado)' value={form.meta_event_novo} onChange={(v) => set("meta_event_novo", v)} placeholder="LZ7_Oportunidade" />
            <Field label='Evento — "atendimento" (qualificado)' value={form.meta_event_atendimento} onChange={(v) => set("meta_event_atendimento", v)} placeholder="Lead" />
            <Field label='Evento — "venda"' value={form.meta_event_venda} onChange={(v) => set("meta_event_venda", v)} placeholder="Purchase" />
            <Field label='Evento — "faturado"' value={form.meta_event_faturado} onChange={(v) => set("meta_event_faturado", v)} placeholder="Purchase" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => m.mutate(form)} disabled={m.isPending} className="gap-1">
              <Check className="h-4 w-4" /> {m.isPending ? "Salvando…" : "Salvar configuração"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Requer <code>META_CAPI_ACCESS_TOKEN</code> configurado no backend. Os nomes vazios usam o padrão
            (<code>Lead</code>/<code>Purchase</code>). Crie a conversão personalizada no Gerenciador de Eventos da Meta
            usando exatamente o mesmo nome do evento.
          </p>
        </>
      )}
    </Card>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const toneCls =
    tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneCls}`}>{value}</div>
    </Card>
  );
}
