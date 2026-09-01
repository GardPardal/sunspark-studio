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
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  MapPin,
  Phone,
  User,
  Zap,
  Building2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
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

type IbgeCity = {
  id: number;
  nome: string;
  microrregiao: { mesorregiao: { UF: { sigla: string; nome: string } } };
};

const DISTRIBUIDORAS = [
  "Copel",
  "Enel SP",
  "CPFL Paulista",
  "CPFL Santa Cruz",
  "Elektro",
  "Energisa",
  "Celesc",
  "Cocel",
  "Forcel",
  "Outra",
];

const FALLBACK_ORIGENS = [
  { name: "Filial Ponta Grossa", value: 609092593 },
  { name: "Sede Wenceslau Braz", value: 600965621 },
  { name: "Filial Londrina", value: 600965622 },
];

const FALLBACK_CAPTACAO = [
  { name: "Ligação ativa", value: 609758031 },
  { name: "Prospecção", value: 600965616 },
  { name: "Indicação", value: 600965617 },
  { name: "Aumento de sistema", value: 601332767 },
  { name: "Reativação", value: 601325073 },
];

const FALLBACK_PRODUTOS = [
  { name: "Energia Solar / On-grid", value: 609639465 },
  { name: "Energia Solar / Híbrido e Bateria", value: 609639466 },
];

type PhoneType = "celular" | "comercial" | "residencial" | "outros";

function SdrLeadQualifiedPage() {
  const register = useServerFn(registerQualifiedLead);
  const loadSchema = useServerFn(getPloomesFormSchema);
  const loadOwners = useServerFn(listResponsavelOptions);

  const { data: schema, isLoading: schemaLoading } = useQuery({
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
  const [distribuidora, setDistribuidora] = useState("Copel");
  const [observacoes, setObservacoes] = useState("");
  const [result, setResult] = useState<any>(null);

  // Default: seleciona On-grid se não houver produto selecionado
  useEffect(() => {
    if (schema?.produto?.length && !produtoId) {
      const onGrid = schema.produto.find((p) => /on.?grid/i.test(p.name)) || schema.produto[0];
      if (onGrid) setProdutoId(onGrid.value);
    } else if (!produtoId) {
      setProdutoId(609639465);
    }
  }, [schema, produtoId]);

  // IBGE Cidades
  const [cities, setCities] = useState<Array<{ nome: string; uf: string }>>([]);
  const [showSug, setShowSug] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
      .then((r) => r.json())
      .then((data: IbgeCity[]) => {
        if (!alive) return;
        setCities(
          data
            .map((c) => ({ nome: c.nome, uf: c.microrregiao?.mesorregiao?.UF?.sigla ?? "" }))
            .filter((c) => c.uf === "PR" || c.uf === "SP")
            .sort((a, b) => a.nome.localeCompare(b.nome)),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
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
    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const nq = norm(q);
    return cities.filter((c) => norm(c.nome).startsWith(nq)).slice(0, 8);
  }, [cidadeQuery, cities]);

  const mut = useMutation({
    mutationFn: async () => {
      const tracking = getPersistedAttribution() as any;
      const cidadeFinal = cidadeSel?.nome || cidadeQuery.trim();
      const estadoFinal = cidadeSel?.uf || "PR";

      const parsedGastoNum = gastoMedio
        ? Number(gastoMedio.replace(/[^0-9,.]/g, "").replace(",", "."))
        : null;

      return register({
        data: {
          nome: nome.trim(),
          telefone: telefone.trim(),
          telefone_tipo: telTipo,
          telefone_tipo_ref: telTipo === "outros" ? telTipoRef.trim() || null : null,
          cidade: cidadeFinal,
          estado: estadoFinal,
          valor_conta: gastoMedio ? `R$ ${gastoMedio}` : null,
          gasto_medio: parsedGastoNum,
          distribuidora: distribuidora || "Copel",
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
      toast.success("Lead registrado e sincronizado com o Ploomes com sucesso!");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao registrar lead"),
  });

  function resetForm() {
    setNome("");
    setTelefone("");
    setTelTipo("celular");
    setTelTipoRef("");
    setCidadeQuery("");
    setCidadeSel(null);
    setOrigemId("");
    setCaptacaoId("");
    setOwnerId("");
    setGastoMedio("");
    setDistribuidora("Copel");
    setObservacoes("");
    setResult(null);
  }

  const parsedGasto = useMemo(() => {
    if (!gastoMedio) return null;
    const n = Number(gastoMedio.replace(/[^0-9,.]/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [gastoMedio]);

  const cidadeOk = cidadeSel?.nome || cidadeQuery.trim().length >= 2;
  const gastoOk = parsedGasto ? parsedGasto >= 150 : true;

  const canSubmit =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 8 &&
    cidadeOk &&
    origemId !== "" &&
    captacaoId !== "" &&
    produtoId !== "" &&
    ownerId !== "" &&
    !mut.isPending;

  const selectCls =
    "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-hidden";

  const origensList = schema?.origem?.length ? schema.origem : FALLBACK_ORIGENS;
  const captacaoList = schema?.captacao?.length ? schema.captacao : FALLBACK_CAPTACAO;
  const produtosList = schema?.produto?.length ? schema.produto : FALLBACK_PRODUTOS;
  const ownersList = schema?.owners?.length ? schema.owners : (owners ?? []);

  return (
    <div className="min-h-screen bg-secondary/30 py-6 px-3 sm:px-6 font-sans text-foreground pb-20">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Cabeçalho */}
        <header className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Formulário SDR · Integração Direta Ploomes
              </span>
            </div>
            <Badge variant="outline" className="text-xs">
              Formulário Oficial
            </Badge>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Registrar Lead Qualificado
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Cadastre os leads manuais e de tráfego qualificados pela SDR. O lead é salvo no CRM
            local, enviado instantaneamente para o <b>Ploomes</b> com o responsável selecionado e
            registrado na Meta.
          </p>
        </header>

        {result ? (
          <Card className="p-6 space-y-4 border-emerald-500/40 bg-card shadow-md rounded-2xl">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-lg font-display">
              <CheckCircle2 className="h-6 w-6" /> Lead Cadastrado com Sucesso!
            </div>

            <div className="rounded-xl bg-secondary/30 p-4 border border-border/60 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Sistema Solar OS:</span>
                <span className="font-bold text-emerald-600 font-mono">
                  ✔ Salvo (ID: {result.lead_id?.slice(0, 8)}…)
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Ploomes CRM:</span>
                <span className="font-bold text-emerald-600">
                  {result.ploomes?.ok ? "✔ Sincronizado com Sucesso" : "⚠ Enviado"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Meta CAPI:</span>
                <span className="font-semibold text-foreground">
                  CompleteRegistration ({result.meta?.status_detail || "registrado"})
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button onClick={resetForm} className="rounded-xl flex-1 font-bold">
                Registrar Outro Lead
              </Button>
              <Button variant="outline" asChild className="rounded-xl flex-1">
                <Link to="/crm">Abrir Kanban do CRM</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-4 sm:p-6 space-y-4 border-border/60 shadow-xs rounded-2xl bg-card">
            {/* Campo 1: Nome */}
            <div className="grid gap-1.5">
              <Label htmlFor="nome" className="text-xs font-semibold">
                <User className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Nome Completo do Lead *
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João da Silva"
                className="rounded-xl text-sm"
                autoFocus
              />
            </div>

            {/* Campo 2: Telefone */}
            <div className="grid gap-1.5">
              <Label htmlFor="tel" className="text-xs font-semibold">
                <Phone className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Telefone / WhatsApp *
              </Label>
              <div className="grid grid-cols-[1fr_130px] gap-2">
                <Input
                  id="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(43) 9 9999-9999"
                  inputMode="tel"
                  className="rounded-xl text-sm"
                />
                <select
                  value={telTipo}
                  onChange={(e) => setTelTipo(e.target.value as PhoneType)}
                  className={selectCls}
                >
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
                  placeholder="Falar com quem? (ex: esposa, sócio)"
                  className="rounded-xl text-xs mt-1"
                />
              )}
            </div>

            {/* Campo 3: Cidade */}
            <div className="grid gap-1.5 relative" ref={boxRef}>
              <Label htmlFor="cidade" className="text-xs font-semibold">
                <MapPin className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Cidade do Imóvel *
              </Label>
              <Input
                id="cidade"
                value={cidadeQuery}
                onChange={(e) => {
                  setCidadeQuery(e.target.value);
                  setCidadeSel(null);
                  setShowSug(true);
                }}
                onFocus={() => setShowSug(true)}
                placeholder="Digite a cidade (ex: Londrina, Wenceslau Braz, Ponta Grossa...)"
                className="rounded-xl text-sm"
                autoComplete="off"
              />
              {cidadeSel && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Selecionada:{" "}
                  <b>
                    {cidadeSel.nome}/{cidadeSel.uf}
                  </b>
                </div>
              )}
              {showSug && suggestions.length > 0 && !cidadeSel && (
                <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-popover border border-border/80 rounded-xl shadow-lg max-h-60 overflow-auto">
                  {suggestions.map((s) => (
                    <button
                      type="button"
                      key={`${s.nome}-${s.uf}`}
                      className="w-full text-left px-3.5 py-2 hover:bg-accent text-xs flex justify-between cursor-pointer"
                      onClick={() => {
                        setCidadeSel(s);
                        setCidadeQuery(s.nome);
                        setShowSug(false);
                      }}
                    >
                      <span className="font-medium text-foreground">{s.nome}</span>
                      <span className="text-muted-foreground">{s.uf}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Campo 4: Origem do Lead (Filial Ploomes) */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">
                <Building2 className="inline h-3.5 w-3.5 mr-1 text-primary" />
                Origem do Lead (Filial) *
              </Label>
              <select
                value={origemId}
                onChange={(e) => setOrigemId(e.target.value ? Number(e.target.value) : "")}
                className={selectCls}
              >
                <option value="">Selecione a Filial…</option>
                {origensList.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Campo 5: Captação Ploomes */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Como foi feita a captação do Lead? *</Label>
              <select
                value={captacaoId}
                onChange={(e) => setCaptacaoId(e.target.value ? Number(e.target.value) : "")}
                className={selectCls}
              >
                <option value="">Selecione o canal…</option>
                {captacaoList.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Campo 6: Produto Ploomes */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Produto de Interesse *</Label>
              <select
                value={produtoId}
                onChange={(e) => setProdutoId(e.target.value ? Number(e.target.value) : "")}
                className={selectCls}
              >
                <option value="">Selecione o produto…</option>
                {produtosList.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.name}
                  </option>
                ))}
                <option value={-1}>Aumento de Sistema</option>
              </select>
            </div>

            {/* Campo 7: Gasto Médio e Distribuidora */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="valor" className="text-xs font-semibold">
                  <Zap className="inline h-3.5 w-3.5 mr-1 text-amber-500" />
                  Gasto Médio de Energia (R$)
                </Label>
                <Input
                  id="valor"
                  value={gastoMedio}
                  onChange={(e) => setGastoMedio(e.target.value)}
                  placeholder="Ex: R$ 650,00"
                  className="rounded-xl text-sm"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="dist" className="text-xs font-semibold">
                  Distribuidora de Energia
                </Label>
                <select
                  id="dist"
                  value={distribuidora}
                  onChange={(e) => setDistribuidora(e.target.value)}
                  className={selectCls}
                >
                  {DISTRIBUIDORAS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Campo 8: Observação */}
            <div className="grid gap-1.5">
              <Label htmlFor="obs" className="text-xs font-semibold">
                Observação do Lead (Contexto para o Consultor)
              </Label>
              <Textarea
                id="obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                placeholder="Ex: Cliente tem açougue e quer zerar conta de luz de R$ 1.200/mês..."
                className="rounded-xl text-xs"
              />
            </div>

            {/* Campo 9: Responsável Comercial Ploomes */}
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Consultor Responsável (Ploomes) *</Label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : "")}
                className={selectCls}
              >
                <option value="">Selecione o consultor…</option>
                {ownersList.map((o: any) => (
                  <option key={o.value} value={o.value}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Botão de Envio */}
            <div className="pt-2">
              <Button
                onClick={() => mut.mutate()}
                disabled={!canSubmit}
                className="w-full h-11 rounded-xl text-sm font-bold shadow-xs transition"
                size="lg"
              >
                {mut.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sincronizando com Ploomes…
                  </>
                ) : (
                  <>
                    Registrar e Enviar para o Ploomes <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              {!canSubmit && (
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Preencha o <b>Nome</b>, <b>Telefone</b>, <b>Cidade</b>, <b>Filial</b>,{" "}
                  <b>Captação</b> e <b>Responsável</b> para liberar o envio.
                </p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
