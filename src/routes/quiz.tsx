import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, Loader2, MessageCircle, ShieldCheck, Sun } from "lucide-react";
import {
  collectAttribution,
  getPersistedAttribution,
  initAllTrackers,
  newEventId,
  persistFirstTouch,
  trackLeadConversion,
  trackMetaEvent,
} from "@/lib/tracking";
import { useResolvedSiteSettings } from "@/lib/site-settings";

/** Número da SDR (Stephany) — 55 + DDD + número, somente dígitos. */
const SDR_WHATSAPP = "5543999760685";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "Simulação de Energia Solar em 1 minuto · LZ7 Energia" },
      {
        name: "description",
        content:
          "Responda 6 perguntas rápidas e descubra se a energia solar vale a pena para o seu consumo. Financiamos até 100%, sem entrada e com carência de até 90 dias.",
      },
      { property: "og:title", content: "Simulação de Energia Solar em 1 minuto · LZ7 Energia" },
      {
        property: "og:description",
        content: "Quiz rápido de qualificação: descubra sua economia e fale direto com nossa consultora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: QuizPage,
});

/* ------------------------------- estrutura -------------------------------- */

type Option = { value: string; label: string; hint?: string; disqualify?: boolean; disqualifyReason?: "regiao" | "consumo" };
type Step = { id: string; question: string; subtitle?: string; options: Option[] };

const STEPS: Step[] = [
  {
    id: "estado",
    question: "Em qual estado fica o imóvel?",
    subtitle: "Hoje atendemos Paraná e São Paulo.",
    options: [
      { value: "PR", label: "Paraná" },
      { value: "SP", label: "São Paulo" },
      { value: "outro", label: "Outro estado", hint: "Ainda não atendemos", disqualify: true, disqualifyReason: "regiao" },
    ],
  },
  {
    id: "gasto",
    question: "Quanto você paga de luz por mês, em média?",
    subtitle: "Use a média dos últimos 3 meses da sua conta.",
    options: [
      { value: "ate_190", label: "Até R$ 190", hint: "Abaixo do mínimo para viabilidade", disqualify: true, disqualifyReason: "consumo" },
      { value: "200_400", label: "R$ 200 a R$ 400", hint: "Perfil mínimo aprovado" },
      { value: "400_700", label: "R$ 400 a R$ 700", hint: "Bom potencial" },
      { value: "700_1500", label: "R$ 700 a R$ 1.500", hint: "Alto potencial" },
      { value: "acima_1500", label: "Acima de R$ 1.500", hint: "Excelente potencial" },
    ],
  },
  {
    id: "objetivo",
    question: "Qual é o seu objetivo hoje?",
    options: [
      { value: "economia", label: "Economizar na conta de luz" },
      { value: "aumentar_consumo", label: "Vou aumentar meu consumo (ar-condicionado, obra, produção)" },
      { value: "energia_backup", label: "Não ficar sem energia quando falta luz" },
      { value: "curiosidade", label: "Só estou pesquisando preço por curiosidade" },
    ],
  },
  {
    id: "local",
    question: "Esse gasto é de qual tipo de imóvel?",
    options: [
      { value: "residencia", label: "Somente residência" },
      { value: "residencia_comercio", label: "Residência + comércio no mesmo local" },
      { value: "comercio", label: "Comércio ou empresa" },
      { value: "rural", label: "Sítio, chácara ou propriedade rural" },
    ],
  },
  {
    id: "padrao",
    question: "Qual é o padrão de entrada do imóvel?",
    subtitle: "Se não souber, tudo bem — a consultora confere na sua conta de luz.",
    options: [
      { value: "monofasico", label: "Monofásico (110)" },
      { value: "bifasico", label: "Bifásico (110 e 220)" },
      { value: "trifasico", label: "Trifásico" },
      { value: "nao_sei", label: "Não sei informar" },
    ],
  },
  {
    id: "decisor",
    question: "A conta de luz está no seu nome ou você decide junto com quem está?",
    options: [
      { value: "sim", label: "Sim, sou eu quem decide" },
      { value: "decide_junto", label: "Decido junto com meu cônjuge/sócio" },
      { value: "nao", label: "Não, é de outra pessoa e não participo da decisão" },
    ],
  },
  {
    id: "prazo",
    question: "Se o valor da parcela couber no que você já paga de luz, quando pretende começar?",
    subtitle: "Financiamos até 100%, sem entrada e com a 1ª parcela em até 90 dias.",
    options: [
      { value: "imediato", label: "Agora, quero orçamento hoje" },
      { value: "30_dias", label: "Nos próximos 30 dias" },
      { value: "90_dias", label: "Em até 3 meses" },
      { value: "sem_previsao", label: "Sem previsão, só quero saber valores" },
    ],
  },
];

const LABELS: Record<string, string> = {
  estado: "Estado",
  gasto: "Gasto médio de luz",
  objetivo: "Objetivo",
  local: "Tipo de imóvel",
  padrao: "Padrão de entrada",
  decisor: "Decisor",
  prazo: "Prazo para iniciar",
};

function labelOf(stepId: string, value: string) {
  return STEPS.find((s) => s.id === stepId)?.options.find((o) => o.value === value)?.label ?? value;
}

function formatPhoneBR(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* --------------------------------- página --------------------------------- */

type Phase = "quiz" | "form" | "disqualified" | "redirect";

function QuizPage() {
  const [phase, setPhase] = useState<Phase>("quiz");
  const [motivo, setMotivo] = useState<"regiao" | "consumo">("consumo");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidadeQuery, setCidadeQuery] = useState("");
  const [selectedCidade, setSelectedCidade] = useState<{ nome: string; uf: string } | null>(null);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [cities, setCities] = useState<Array<{ nome: string; uf: string }>>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [waUrl, setWaUrl] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const cityBoxRef = useRef<HTMLDivElement>(null);
  const settings = useResolvedSiteSettings();

  useEffect(() => {
    persistFirstTouch();
  }, []);

  // Pixel Meta + GA4/Ads/TikTok (PageView automático)
  useEffect(() => {
    initAllTrackers({
      gtm_id: settings.gtm_id,
      ga4_measurement_id: settings.ga4_measurement_id,
      google_ads_id: settings.google_ads_id,
      meta_pixel_id: settings.meta_pixel_id,
      tiktok_pixel_id: settings.tiktok_pixel_id,
    });
  }, [
    settings.gtm_id,
    settings.ga4_measurement_id,
    settings.google_ads_id,
    settings.meta_pixel_id,
    settings.tiktok_pixel_id,
  ]);

  // Início do quiz → ViewContent
  useEffect(() => {
    if (!settings.meta_pixel_id) return;
    const t = setTimeout(
      () => trackMetaEvent("ViewContent", { content_name: "quiz_solar", content_category: "solar_energy" }),
      1200,
    );
    return () => clearTimeout(t);
  }, [settings.meta_pixel_id]);

  // Chegou no formulário (lead qualificado) → InitiateCheckout
  useEffect(() => {
    if (phase === "form") {
      trackMetaEvent("InitiateCheckout", { content_name: "quiz_solar_qualificado", currency: "BRL", value: 1 });
    }
  }, [phase]);

  // Carrega cidades do IBGE do estado selecionado (PR/SP), com 1 retry
  useEffect(() => {
    const uf = answers.estado;
    if (uf !== "PR" && uf !== "SP") {
      setCities([]);
      return;
    }
    let alive = true;
    setCitiesLoading(true);
    const load = async (attempt = 0): Promise<void> => {
      try {
        const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
        const data: Array<{ id: number; nome: string }> = await r.json();
        if (!alive) return;
        setCities(data.map((c) => ({ nome: c.nome, uf })).sort((a, b) => a.nome.localeCompare(b.nome)));
        setCitiesLoading(false);
      } catch {
        if (attempt < 1) return load(attempt + 1);
        if (alive) { setCities([]); setCitiesLoading(false); }
      }
    };
    void load();
    return () => { alive = false; };
  }, [answers.estado]);


  // Reseta cidade quando o usuário volta e troca o estado
  useEffect(() => {
    if (selectedCidade && selectedCidade.uf !== answers.estado) {
      setSelectedCidade(null);
      setCidadeQuery("");
    }
  }, [answers.estado, selectedCidade]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (cityBoxRef.current && !cityBoxRef.current.contains(e.target as Node)) setShowCitySuggestions(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const citySuggestions = useMemo(() => {
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const nq = norm(cidadeQuery.trim());
    if (!nq) return cities.slice(0, 8);
    const starts = cities.filter((c) => norm(c.nome).startsWith(nq));
    const contains = cities.filter((c) => !norm(c.nome).startsWith(nq) && norm(c.nome).includes(nq));
    return [...starts, ...contains].slice(0, 8);
  }, [cidadeQuery, cities]);

  const step = STEPS[index];
  const progress = Math.round(((index + (phase === "form" ? 1 : 0)) / (STEPS.length + 1)) * 100);

  function choose(opt: Option) {
    const next = { ...answers, [step.id]: opt.value };
    setAnswers(next);
    if (opt.disqualify) {
      setMotivo(opt.disqualifyReason ?? "consumo");
      setPhase("disqualified");
      return;
    }
    if (index + 1 < STEPS.length) setIndex(index + 1);
    else setPhase("form");
  }

  function back() {
    if (phase === "form") {
      setPhase("quiz");
      return;
    }
    if (phase === "disqualified") {
      setPhase("quiz");
      return;
    }
    if (index > 0) setIndex(index - 1);
  }

  const resumo = useMemo(
    () =>
      STEPS.filter((s) => answers[s.id]).map((s) => `• ${LABELS[s.id]}: ${labelOf(s.id, answers[s.id])}`).join("\n"),
    [answers],
  );

  const canSubmit =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 10 &&
    selectedCidade !== null &&
    (selectedCidade.uf === "PR" || selectedCidade.uf === "SP") &&
    !sending;


  async function submit() {
    setErro(null);
    if (!selectedCidade || (selectedCidade.uf !== "PR" && selectedCidade.uf !== "SP")) {
      setErro("Selecione sua cidade no Paraná ou em São Paulo.");
      setSending(false);
      return;
    }
    setSending(true);
    // first-touch (UTMs) + cookies atuais do Pixel (_fbp/_fbc já existem depois do load)
    const fresh = collectAttribution();
    const attr = {
      ...getPersistedAttribution(),
      ...Object.fromEntries(Object.entries(fresh).filter(([, v]) => Boolean(v))),
    };
    const eventId = newEventId("quiz");
    const mensagem = `Qualificação via quiz do site:\n${resumo}`;

    const message =
      `Olá Stephany! Sou ${nome.trim()}${selectedCidade.nome ? `, de ${selectedCidade.nome}/${selectedCidade.uf}` : ""}. ` +
      `Fiz a simulação no site da LZ7 e quero meu orçamento de energia solar.\n\n${resumo}`;

    const url = `https://wa.me/${SDR_WHATSAPP}?text=${encodeURIComponent(message)}`;

    // 1) Pixel do navegador (mesmo event_id da CAPI → sem duplicidade na Meta)
    trackLeadConversion({
      adsId: settings.google_ads_id,
      adsLabel: settings.google_ads_conversion_label,
      value: 1,
      currency: "BRL",
      eventId,
    });

    // 2) Servidor → Meta CAPI (garante a conversão mesmo com bloqueador de anúncios)
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telefone.trim(),
          cidade: selectedCidade.nome,
          estado: selectedCidade.uf,

          valor_conta: labelOf("gasto", answers.gasto ?? ""),
          mensagem,
          origem: "quiz-site",
          event_id: eventId,
          page_url: typeof window !== "undefined" ? window.location.href : null,
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
          ...attr,
        }),
      });
      if (!res.ok) console.warn("[quiz] lead endpoint status", res.status);
    } catch {
      // não bloqueia o lead de falar com a SDR
    }

    setWaUrl(url);
    setPhase("redirect");
    setSending(false);
    // abre imediatamente dentro do gesto do usuário
    window.location.href = url;
  }

  return (
    <main className="min-h-svh bg-gradient-to-b from-background via-background to-primary/5 px-4 py-8">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Sun className="h-4 w-4 text-primary" />
          <span className="font-medium">LZ7 Energia</span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" /> Sem custo · 1 minuto
          </span>
        </header>

        {phase !== "redirect" && phase !== "disqualified" && (
          <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.max(progress, 8)}%` }} />
          </div>
        )}

        {phase === "quiz" && (
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pergunta {index + 1} de {STEPS.length}
            </p>
            <h1 className="font-display text-2xl font-semibold leading-tight text-foreground">{step.question}</h1>
            {step.subtitle && <p className="mt-2 text-sm text-muted-foreground">{step.subtitle}</p>}

            <div className="mt-5 grid gap-2">
              {step.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => choose(o)}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3.5 text-left transition hover:border-primary hover:bg-primary/5 active:scale-[0.99]"
                >
                  <span className="text-[15px] font-medium text-foreground">{o.label}</span>
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40 group-hover:border-primary" />
                </button>
              ))}
            </div>

            {index > 0 && (
              <button type="button" onClick={back} className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
            )}
          </section>
        )}

        {phase === "form" && (
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Perfil aprovado para orçamento
            </div>
            <h1 className="font-display text-2xl font-semibold leading-tight">Para onde enviamos sua simulação?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ao continuar, você fala direto com a Stephany no WhatsApp com todas as suas respostas já preenchidas.
            </p>

            <div className="mt-5 grid gap-4">
              <Field label="Seu nome *">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoFocus
                  autoComplete="name"
                  placeholder="Nome completo"
                  className="h-12 w-full rounded-xl border bg-background px-4 text-[15px] outline-none focus:border-primary"
                />
              </Field>
              <Field label="WhatsApp *">
                <div className="relative">
                  <input
                    value={telefone}
                    onChange={(e) => setTelefone(formatPhoneBR(e.target.value))}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(43) 9 9999-9999"
                    className="h-12 w-full rounded-xl border-2 border-primary/40 bg-background px-4 text-[15px] font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary">WhatsApp</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Enviaremos sua simulação por aqui. Certifique-se de que o número está correto.</p>
              </Field>

              <Field label="Cidade *">
                <div className="relative" ref={cityBoxRef}>
                  <input
                    value={cidadeQuery}
                    onChange={(e) => { setCidadeQuery(e.target.value); setSelectedCidade(null); setShowCitySuggestions(true); }}
                    onFocus={() => setShowCitySuggestions(true)}
                    placeholder={answers.estado ? "Comece a digitar (ex: Londr…)" : "Selecione PR ou SP na pergunta anterior"}
                    disabled={!answers.estado || (answers.estado !== "PR" && answers.estado !== "SP")}
                    autoComplete="off"
                    className="h-12 w-full rounded-xl border bg-background px-4 text-[15px] outline-none focus:border-primary disabled:opacity-50"
                  />
                  {selectedCidade && (
                    <div className="mt-1 text-xs text-muted-foreground">Selecionada: <b>{selectedCidade.nome}/{selectedCidade.uf}</b></div>
                  )}
                  {showCitySuggestions && !selectedCidade && citySuggestions.length > 0 && (
                    <div className="absolute top-full z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-popover shadow-lg">
                      {citySuggestions.map((s) => (
                        <button
                          type="button"
                          key={`${s.nome}-${s.uf}`}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-accent"
                          onClick={() => { setSelectedCidade(s); setCidadeQuery(s.nome); setShowCitySuggestions(false); }}
                        >
                          <span>{s.nome}</span>
                          <span className="text-muted-foreground">{s.uf}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showCitySuggestions && !selectedCidade && citySuggestions.length === 0 && (
                    <div className="absolute top-full z-10 mt-1 w-full rounded-xl border bg-popover px-4 py-2.5 text-sm text-muted-foreground shadow-lg">
                      {citiesLoading ? "Carregando cidades…" : "Nenhuma cidade encontrada"}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Qualquer cidade do Paraná ou de São Paulo. Digite o nome e escolha da lista.</p>
              </Field>


            </div>

            {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-[16px] font-semibold text-primary-foreground transition disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
              {sending ? "Preparando…" : "Falar no WhatsApp agora"}
            </button>

            <button type="button" onClick={back} className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
          </section>
        )}

        {phase === "disqualified" && (
          <section className="rounded-2xl border bg-card p-6 text-center shadow-sm">
            <h1 className="font-display text-2xl font-semibold">
              {motivo === "regiao" ? "Ainda não atendemos a sua região" : "Obrigado por responder!"}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {motivo === "regiao"
                ? "No momento a LZ7 Energia realiza instalações apenas no Paraná e em São Paulo. Guardamos seu interesse e, assim que chegarmos ao seu estado, avisamos você."
                : "Pelo seu perfil atual, a energia solar ainda não traria uma economia que justifique o investimento. Guardamos suas respostas e, quando seu consumo ou o momento mudar, a gente te avisa com uma proposta que realmente vale a pena."}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Se você acredita que respondeu algo por engano, é só refazer a simulação.
            </p>
            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setIndex(0);
                setPhase("quiz");
              }}
              className="mt-5 h-11 w-full rounded-xl border px-4 font-medium hover:bg-accent"
            >
              Refazer simulação
            </button>
          </section>
        )}

        {phase === "redirect" && (
          <section className="rounded-2xl border bg-card p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-3 font-display text-2xl font-semibold">Abrindo seu WhatsApp…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A mensagem já vai preenchida. <b>Toque no botão verde de enviar</b> para a Stephany receber agora.
            </p>
            <a
              href={waUrl}
              className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 font-semibold text-primary-foreground"
            >
              <MessageCircle className="h-5 w-5" /> Abrir conversa novamente
            </a>
          </section>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Financiamos até 100%, sem entrada, com a 1ª parcela em até 90 dias.
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
