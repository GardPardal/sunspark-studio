import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, Sparkles, MapPin, Phone, User, Zap } from "lucide-react";
import { registerQualifiedLead } from "@/lib/sdr-leads.functions";
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

function SdrLeadQualifiedPage() {
  const register = useServerFn(registerQualifiedLead);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidadeQuery, setCidadeQuery] = useState("");
  const [cidadeSel, setCidadeSel] = useState<{ nome: string; uf: string } | null>(null);
  const [valorConta, setValorConta] = useState("");
  const [distribuidora, setDistribuidora] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [origem] = useState("Meta WhatsApp");
  const [result, setResult] = useState<any>(null);

  // ---- IBGE cidades: carrega 1x, filtra client-side ----
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
          data.map((c) => ({ nome: c.nome, uf: c.microrregiao?.mesorregiao?.UF?.sigla ?? "" })),
        );
      })
      .catch(() => {/* silencioso — usuário pode digitar manualmente */});
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
    return cities
      .filter((c) => norm(c.nome).startsWith(nq))
      .slice(0, 8);
  }, [cidadeQuery, cities]);

  const mut = useMutation({
    mutationFn: async () => {
      const tracking = getPersistedAttribution() as any;
      return register({
        data: {
          nome: nome.trim(),
          telefone: telefone.trim(),
          cidade: cidadeSel?.nome || cidadeQuery.trim(),
          estado: cidadeSel?.uf || null,
          valor_conta: valorConta || null,
          distribuidora: distribuidora || null,
          observacoes: observacoes || null,
          origem,
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
    setNome(""); setTelefone(""); setCidadeQuery(""); setCidadeSel(null);
    setValorConta(""); setDistribuidora(""); setObservacoes(""); setResult(null);
  }

  const canSubmit =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 10 &&
    (cidadeSel?.nome || cidadeQuery.trim().length >= 2) &&
    !mut.isPending;

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
            Após qualificar pelo WhatsApp, registre aqui. O sistema envia CompleteRegistration para a Meta e cria Contato + Negócio no Ploomes automaticamente.
          </p>
        </header>

        {result ? (
          <Card className="p-6 space-y-4 border-emerald-500/40 bg-emerald-500/5">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="h-5 w-5" /> Lead registrado
            </div>
            <ul className="space-y-1.5 text-sm">
              <li>✔ Lead salvo no banco (id: <code className="text-xs">{result.lead_id}</code>)</li>
              <li>
                {result.meta?.ok ? "✔" : "✖"} Evento{" "}
                <b>CompleteRegistration</b> enviado para Meta
                {result.meta?.event_id && (
                  <span className="text-muted-foreground"> · event_id: <code className="text-xs">{result.meta.event_id.slice(0, 12)}…</code></span>
                )}
                {result.meta?.fbtrace_id && (
                  <span className="text-muted-foreground"> · fbtrace: <code className="text-xs">{result.meta.fbtrace_id}</code></span>
                )}
                {!result.meta?.ok && result.meta?.error && (
                  <div className="text-xs text-destructive mt-1">{result.meta.error}</div>
                )}
              </li>
              <li>✔ Contato criado no Ploomes</li>
              <li>✔ Negócio (Deal) criado no Ploomes</li>
              <li>✔ Pronto para distribuição</li>
            </ul>
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
              <Label htmlFor="nome"><User className="inline h-3.5 w-3.5 mr-1" />Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" autoFocus />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tel"><Phone className="inline h-3.5 w-3.5 mr-1" />Telefone</Label>
              <Input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(43) 9 9999-9999" inputMode="tel" />
            </div>

            <div className="grid gap-2 relative" ref={boxRef}>
              <Label htmlFor="cidade"><MapPin className="inline h-3.5 w-3.5 mr-1" />Cidade</Label>
              <Input
                id="cidade"
                value={cidadeQuery}
                onChange={(e) => { setCidadeQuery(e.target.value); setCidadeSel(null); setShowSug(true); }}
                onFocus={() => setShowSug(true)}
                placeholder="Comece a digitar (ex: Londr…)"
                autoComplete="off"
              />
              {cidadeSel && (
                <div className="text-xs text-muted-foreground">
                  Selecionada: <b>{cidadeSel.nome}/{cidadeSel.uf}</b>
                </div>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="valor"><Zap className="inline h-3.5 w-3.5 mr-1" />Valor da conta</Label>
                <Input id="valor" value={valorConta} onChange={(e) => setValorConta(e.target.value)} placeholder="R$ 450,00" inputMode="decimal" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dist">Distribuidora</Label>
                <select
                  id="dist"
                  value={distribuidora}
                  onChange={(e) => setDistribuidora(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  <option value="">Selecione…</option>
                  {DISTRIBUIDORAS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="obs">Observações (opcional)</Label>
              <Textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} placeholder="Contexto útil para o consultor" />
            </div>

            <div className="grid gap-2">
              <Label>Origem</Label>
              <Input value={origem} disabled className="bg-muted" />
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
