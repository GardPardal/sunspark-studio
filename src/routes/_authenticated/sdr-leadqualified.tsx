import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Sparkles, MapPin, Phone, User, Zap } from "lucide-react";
import { registerQualifiedLead } from "@/lib/sdr-leads.functions";
import { getPloomesFormSchema } from "@/lib/ploomes-form.functions";
import { listResponsavelOptions } from "@/lib/ploomes-users.functions";
import { getPersistedAttribution } from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/sdr-leadqualified")({
  head: () => ({
    meta: [
      { title: "Registrar Lead Qualificado — SDR · LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SdrLeadQualifiedPage,
});

type IbgeCity = { id: number; nome: string; microrregiao: { mesorregiao: { UF: { sigla: string; nome: string } } } };

const DISTRIBUIDORAS = [
  "Copel", "Enel SP", "Enel RJ", "Enel CE", "Enel GO",
  "CPFL Paulista", "CPFL Piratininga", "CPFL Santa Cruz", "RGE",
  "Light", "Cemig", "Elektro", "Energisa", "Neoenergia Coelba",
  "Neoenergia Cosern", "Neoenergia Pernambuco", "EDP SP", "EDP ES",
  "Equatorial PA", "Equatorial MA", "Equatorial GO", "Equatorial PI",
  "Celesc", "Cocel", "Forcel", "Copel Distribuição", "Outra",
];

type PhoneType = "comercial" | "celular" | "residencial" | "outros";

function SdrLeadQualifiedPage() {
  const register = useServerFn(registerQualifiedLead);
  const loadSchema = useServerFn(getPloomesFormSchema);
  const loadOwners = useServerFn(listResponsavelOptions);

  const { data: schema } = useQuery({
    queryKey: ["ploomes-form-schema"],
    queryFn: () => loadSchema(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: owners } = useQuery({
    queryKey: ["responsavel-options"],
    queryFn: () => loadOwners(),
    staleTime: 5 * 60 * 1000,
  });

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [telTipo, setTelTipo] = useState<PhoneType>("celular");
  const [telTipoRef, setTelTipoRef] = useState("");
  const [cidadeQuery, setCidadeQuery] = useState("");
  const [cidadeSel, setCidadeSel] = useState<{ nome: string; uf: string } | null>(null);
  const [origemId, setOrigemId] = useState<number | "">("");
  const [captacaoId, setCaptacaoId] = useState<number | "">("");
  const [produtoId, setProdutoId] = useState<number | "">("");
  const [ownerId, setOwnerId] = useState<number | "">("");
  const [gastoMedio, setGastoMedio] = useState("");
  const [distribuidora, setDistribuidora] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [result, setResult] = useState<any>(null);

  // Default: produto On-grid quando carregar o schema
  useEffect(() => {
    if (schema && !produtoId) {
      const onGrid = schema.produto.find((p) => /on.?grid/i.test(p.name));
      if (onGrid) setProdutoId(onGrid.value);
    }
  }, [schema, produtoId]);

  // IBGE
  const [cities, setCities] = useState<Array<{ nome: string; uf: string }>>([]);
  const [showSug, setShowSug] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
      .then((r) => r.json())
      .then((data: IbgeCity[]) => {
        if (!alive) return;
        setCities(data.map((c) => ({ nome: c.nome, uf: c.microrregiao?.mesorregiao?.UF?.sigla ?? "" })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSug(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const suggestions = useMemo(() => {
    const q = cidadeQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const nq = norm(q);
    return cities.filter((c) => norm(c.nome).startsWith(nq)).slice(0, 8);
  }, [cidadeQuery, cities]);

  const mut = useMutation({
    mutationFn: async () => {
      const tracking = getPersistedAttribution() as any;
      return register({
        data: {
          nome: nome.trim(),
          telefone: telefone.trim(),
          telefone_tipo: telTipo,
          telefone_tipo_ref: telTipo === "outros" ? telTipoRef.trim() || null : null,
          cidade: cidadeSel?.nome || cidadeQuery.trim(),
          estado: cidadeSel?.uf || null,
          valor_conta: gastoMedio || null,
          gasto_medio: gastoMedio ? Number(gastoMedio.replace(/[^0-9,\.]/g, "").replace(",", ".")) : null,
          distribuidora: distribuidora || null,
          observacoes: observacoes || null,
          origem: "Meta WhatsApp",
          ploomes_origem_id: Number(origemId),
          ploomes_captacao_id: Number(captacaoId),
          ploomes_produto_id: Number(produtoId),
          ploomes_owner_id: Number(ownerId),
          tracking: {
            fbclid: tracking?.fbclid ?? null,
            fbc: tracking?.fbc ?? null,
            fbp: tracking?.fbp ?? null,
            utm_source: tracking?.utm_source ?? null,
            utm_medium: tracking?.utm_medium ?? null,
            utm_campaign: tracking?.utm_campaign ?? null,
            utm_content: tracking?.utm_content ?? null,
            utm_term: tracking?.utm_term ?? null,
            page_url: tracking?.page_url ?? null,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
          },
        },
      });
    },
    onSuccess: (r: any) => {
      setResult(r);
      toast.success("Lead qualificado registrado com sucesso");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao registrar"),
  });

  function resetForm() {
    setNome(""); setTelefone(""); setTelTipo("celular"); setTelTipoRef("");
    setCidadeQuery(""); setCidadeSel(null);
    setOrigemId(""); setCaptacaoId(""); setOwnerId("");
    setGastoMedio(""); setDistribuidora(""); setObservacoes(""); setResult(null);
  }

  const parsedGasto = useMemo(() => {
    if (!gastoMedio) return null;
    const n = Number(gastoMedio.replace(/[^0-9,\.]/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [gastoMedio]);

  const gastoOk = parsedGasto ? parsedGasto > 200 : false;

  const canSubmit =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 10 &&
    (cidadeSel?.nome || cidadeQuery.trim().length >= 2) &&
    origemId && captacaoId && produtoId && ownerId && gastoOk &&
    (telTipo !== "outros" || telTipoRef.trim().length > 0) &&
    !mut.isPending;

  const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background";

  return (
    <div className="min-h-svh bg-gradient-to-br from-background via-background to-primary/5 py-6 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>SDR · Solar OS</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Registrar Lead Qualificado</h1>
          <p className="text-sm text-muted-foreground">
            Após qualificar pelo WhatsApp, registre aqui. O sistema envia CompleteRegistration para a Meta e cria Contato + Negócio no Ploomes com o responsável escolhido.
          </p>
        </header>

        {result ? (
          <Card className="p-6 space-y-4 border-emerald-500/40 bg-emerald-500/5">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="h-5 w-5" /> Lead registrado
            </div>
            <ul className="space-y-1.5 text-sm">
              <li>✔ Lead salvo <span className="text-muted-foreground">(id: <code className="text-xs">{result.lead_id?.slice(0, 8)}…</code>)</span></li>
              <li>{result.ploomes?.ok ? "✔" : "✖"} Ploomes {result.ploomes?.ok ? "criado" : `falhou (${result.ploomes?.status ?? result.ploomes?.error ?? "—"})`}</li>
              <li>
                {result.meta?.ok ? "✔" : result.meta?.validation_errors?.length ? "⚠" : "✖"}{" "}
                CompleteRegistration <b>{result.meta?.status_detail?.replace("_", " ") ?? "—"}</b>
              </li>
            </ul>

            {result.meta?.validation_errors?.length ? (
              <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900">
                <b>Meta não recebeu — dados obrigatórios ausentes:</b>
                <ul className="list-disc pl-4 mt-1">
                  {result.meta.validation_errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            ) : (
              <div className="rounded-md bg-background/60 border p-3 text-xs font-mono grid grid-cols-2 gap-x-4 gap-y-1">
                <div><span className="text-muted-foreground">Pixel:</span> {result.meta?.pixel_id ?? "—"}</div>
                <div><span className="text-muted-foreground">HTTP:</span> {result.meta?.http_status ?? "—"}</div>
                <div className="col-span-2 truncate"><span className="text-muted-foreground">Event ID:</span> {result.meta?.event_id ?? "—"}</div>
                <div className="col-span-2 truncate"><span className="text-muted-foreground">FB Trace ID:</span> {result.meta?.fbtrace_id ?? "—"}</div>
                <div><span className="text-muted-foreground">Match Quality:</span> <b>{result.meta?.match_quality ?? 0}/10</b></div>
                {result.meta?.test_mode && <div className="text-amber-700">Modo TESTE ativo</div>}
              </div>
            )}
            {!result.meta?.ok && result.meta?.error && (
              <div className="text-xs text-destructive">{result.meta.error}</div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={resetForm}>Registrar outro lead</Button>
              <Button variant="outline" asChild>
                <Link to="/mod/meta-conversions">Ver log de conversões</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6 space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="nome"><User className="inline h-3.5 w-3.5 mr-1" />Nome *</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tel"><Phone className="inline h-3.5 w-3.5 mr-1" />Telefone *</Label>
              <div className="grid grid-cols-[1fr_160px] gap-2">
                <Input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(43) 9 9999-9999" inputMode="tel" />
                <select value={telTipo} onChange={(e) => setTelTipo(e.target.value as PhoneType)} className={selectCls}>
                  <option value="celular">Celular</option>
                  <option value="comercial">Comercial</option>
                  <option value="residencial">Residencial</option>
                  <option value="outros">Outros</option>
                </select>
              </div>
              {telTipo === "outros" && (
                <Input
                  value={telTipoRef}
                  onChange={(e) => setTelTipoRef(e.target.value)}
                  placeholder="Falar com quem? (ex.: esposa do cliente)"
                />
              )}
            </div>

            <div className="grid gap-2 relative" ref={boxRef}>
              <Label htmlFor="cidade"><MapPin className="inline h-3.5 w-3.5 mr-1" />Cidade *</Label>
              <Input
                id="cidade"
                value={cidadeQuery}
                onChange={(e) => { setCidadeQuery(e.target.value); setCidadeSel(null); setShowSug(true); }}
                onFocus={() => setShowSug(true)}
                placeholder="Comece a digitar (ex: Londr…)"
                autoComplete="off"
              />
              {cidadeSel && (
                <div className="text-xs text-muted-foreground">Selecionada: <b>{cidadeSel.nome}/{cidadeSel.uf}</b></div>
              )}
              {showSug && suggestions.length > 0 && !cidadeSel && (
                <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {suggestions.map((s) => (
                    <button
                      type="button"
                      key={`${s.nome}-${s.uf}`}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between"
                      onClick={() => { setCidadeSel(s); setCidadeQuery(s.nome); setShowSug(false); }}
                    >
                      <span>{s.nome}</span>
                      <span className="text-muted-foreground">{s.uf}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Origem do Lead (Filial) *</Label>
              <select value={origemId} onChange={(e) => setOrigemId(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
                <option value="">Selecione…</option>
                {schema?.origem.map((o) => <option key={o.value} value={o.value}>{o.name}</option>)}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Como foi feita a captação do Lead? *</Label>
              <select value={captacaoId} onChange={(e) => setCaptacaoId(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
                <option value="">Selecione…</option>
                {schema?.captacao.map((o) => <option key={o.value} value={o.value}>{o.name}</option>)}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>Produto de interesse *</Label>
              <select value={produtoId} onChange={(e) => setProdutoId(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
                <option value="">Selecione…</option>
                {schema?.produto.map((o) => <option key={o.value} value={o.value}>{o.name}</option>)}
                <option value={-1}>Aumento de Sistema</option>
              </select>
            </div>


            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="valor"><Zap className="inline h-3.5 w-3.5 mr-1" />Gasto médio de energia *</Label>
                <Input id="valor" value={gastoMedio} onChange={(e) => setGastoMedio(e.target.value)} placeholder="R$ 450,00" inputMode="decimal" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dist">Distribuidora</Label>
                <select id="dist" value={distribuidora} onChange={(e) => setDistribuidora(e.target.value)} className={selectCls}>
                  <option value="">Selecione…</option>
                  {DISTRIBUIDORAS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="obs">Observação do Lead</Label>
              <Textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Contexto útil para o consultor" />
            </div>

            <div className="grid gap-2">
              <Label>Responsável *</Label>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
                <option value="">Selecione…</option>
                {(owners ?? schema?.owners ?? []).map((o) => <option key={o.value} value={o.value}>{o.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">
                Lista sincronizada do Ploomes. Novos usuários cadastrados lá aparecem automaticamente.
              </p>
            </div>

            <Button
              onClick={() => mut.mutate()}
              disabled={!canSubmit}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              {mut.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
              ) : (
                "Registrar Lead Qualificado"
              )}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
