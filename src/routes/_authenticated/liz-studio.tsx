import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Sparkles, Download, Wand2, Loader2, Image as ImageIcon, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BackendTopBar } from "@/components/backend-shell";

export const Route = createFileRoute("/_authenticated/liz-studio")({
  head: () => ({
    meta: [
      { title: "LIZ Studio — Geração de Imagens LZ7" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LizStudioPage,
});

type GenResult = {
  imageUrl: string;
  prompt: string;
  title: string;
  model: string;
  idea: string;
  batchId: number;
  ts: number;
};

const MODELS = [
  { id: "openai/gpt-image-2", label: "GPT Image 2 · Fotorrealismo topo (padrão)" },
  { id: "google/gemini-3-pro-image", label: "Gemini 3 Pro Image · Alta qualidade Google" },
  { id: "google/gemini-3.1-flash-image", label: "Nano Banana 2 · Rápido e criativo" },
  { id: "openai/gpt-image-1-mini", label: "GPT Image 1 Mini · Rápido e barato" },
];

const SIZES = [
  { id: "1024x1024", label: "Quadrada · 1:1" },
  { id: "1536x1024", label: "Paisagem · 3:2" },
  { id: "1024x1536", label: "Retrato · 2:3" },
];

const PRESETS = [
  "Painel solar instalado em telhado cerâmico de casa brasileira no fim da tarde, luz dourada, família sorrindo ao fundo",
  "Consultor LZ7 uniformizado apresentando proposta em tablet para casal na sala, ambiente aconchegante, luz natural",
  "Usina solar fotovoltaica de grande porte vista de drone, campo verde do Paraná, céu azul cinematográfico",
  "Close-up macro em célula fotovoltaica com reflexo do sol, gotas de orvalho, hiper-detalhado",
];

function LizStudioPage() {
  const [idea, setIdea] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [size, setSize] = useState(SIZES[0].id);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const [refine, setRefine] = useState(true);
  const [refs, setRefs] = useState<{ name: string; dataUrl: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GenResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const slots = 5 - refs.length;
    const list = Array.from(files).slice(0, slots);
    const loaded = await Promise.all(
      list.map(
        (f) =>
          new Promise<{ name: string; dataUrl: string } | null>((resolve) => {
            if (!f.type.startsWith("image/")) return resolve(null);
            if (f.size > 8 * 1024 * 1024) {
              setError(`"${f.name}" passa de 8MB.`);
              return resolve(null);
            }
            const reader = new FileReader();
            reader.onload = () =>
              resolve({ name: f.name, dataUrl: String(reader.result) });
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(f);
          }),
      ),
    );
    setRefs((prev) => [...prev, ...loaded.filter(Boolean) as { name: string; dataUrl: string }[]]);
  };

  const removeRef = (i: number) => setRefs((prev) => prev.filter((_, idx) => idx !== i));

  const generate = async () => {
    const text = idea.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Faça login novamente.");
      const res = await fetch("/api/public/liz-image", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: text,
          model,
          size,
          quality,
          refine,
          inputImages: refs.map((r) => r.dataUrl),
        }),
      });
      const json = (await res.json()) as {
        images?: Array<{ imageUrl: string; prompt: string; title: string; model: string }>;
        error?: string;
      };
      if (!res.ok || !json.images || json.images.length === 0) {
        throw new Error(json.error || `Falha (${res.status})`);
      }
      const batchId = Date.now();
      const now = Date.now();
      setResults((prev) => [
        ...json.images!.map((im, i) => ({
          imageUrl: im.imageUrl,
          prompt: im.prompt,
          title: im.title,
          model: im.model,
          idea: text,
          batchId,
          ts: now + i,
        })),
        ...prev,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const download = (r: GenResult) => {
    const a = document.createElement("a");
    a.href = r.imageUrl;
    a.download = `liz-${r.ts}.png`;
    a.click();
  };

  return (
    <div className="min-h-dvh bg-muted/20">
      <BackendTopBar
        title="LIZ Studio"
        subtitle="Geração de imagens fotorrealistas com IA"
      />

      <div className="mx-auto grid max-w-6xl gap-6 p-4 md:grid-cols-[380px_1fr] md:p-6">
        {/* Painel de controle */}
        <aside className="space-y-4 rounded-2xl border border-border bg-background p-4 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <h2 className="font-semibold">Descreva a imagem</h2>
          </div>

          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={5}
            placeholder="Ex: Instalação solar em casa no interior do Paraná ao pôr do sol, família feliz observando…"
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdea(p)}
                className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Ideia {i + 1}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Imagens de referência ({refs.length}/5)
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={refs.length >= 5}
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" />
                Carregar
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {refs.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {refs.map((r, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-md border border-border">
                    <img src={r.dataUrl} alt={r.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeRef(i)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                      aria-label="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {refs.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Com referências, a LIZ usa Gemini 3 Pro Image para editar/misturar suas fotos.
              </p>
            )}
          </div>

          <div className="space-y-2">

            <label className="text-xs font-medium text-muted-foreground">Modelo</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Formato</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                {SIZES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Qualidade</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as "low" | "medium" | "high")}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="low">Baixa (rápida)</option>
                <option value="medium">Média</option>
                <option value="high">Alta (máxima)</option>
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs">
            <input
              type="checkbox"
              checked={refine}
              onChange={(e) => setRefine(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong>LIZ melhora meu prompt</strong> — reescreve sua ideia em um prompt
              cinematográfico em inglês para máximo realismo.
            </span>
          </label>

          <button
            type="button"
            onClick={generate}
            disabled={loading || !idea.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Gerar imagem
              </>
            )}
          </button>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </aside>

        {/* Galeria */}
        <main className="space-y-4">
          {results.length === 0 && !loading && (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background/50 p-8 text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10" />
              <p className="text-sm">
                Descreva sua ideia à esquerda e a LIZ gera imagens fotorrealistas em segundos.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border bg-background">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">LIZ está pintando…</p>
              </div>
            </div>
          )}

          {results.map((r) => (
            <article
              key={r.ts}
              className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm"
            >
              <img
                src={r.imageUrl}
                alt={r.idea}
                className="w-full object-cover"
                loading="lazy"
              />
              <div className="space-y-2 p-4">
                <p className="text-sm font-medium">{r.idea}</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{r.prompt}</p>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {r.model}
                  </span>
                  <button
                    type="button"
                    onClick={() => download(r)}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </main>
      </div>
    </div>
  );
}
