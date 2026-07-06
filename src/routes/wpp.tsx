import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { MessageCircle, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings, waHref, DEFAULT_SETTINGS } from "@/lib/site-settings";
import {
  initAllTrackers,
  trackLeadConversion,
  persistFirstTouch,
  getPersistedAttribution,
} from "@/lib/tracking";
import logoAsset from "@/assets/lz7-logo.png.asset.json";

export const Route = createFileRoute("/wpp")({
  head: () => ({
    meta: [
      { title: "Fale com um consultor · LZ7 Energia" },
      { name: "description", content: "Fale agora com um consultor da LZ7 Energia pelo WhatsApp e receba um orçamento gratuito de energia solar." },
      { name: "robots", content: "noindex,follow" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: WppPage,
});

/* ------------------------------- validation ------------------------------- */

const schema = z.object({
  nome: z.string().trim().min(2, "Digite seu nome").max(80, "Nome muito longo"),
  telefone: z
    .string()
    .trim()
    .min(10, "Telefone inválido")
    .max(20, "Telefone inválido")
    .regex(/^[0-9\s()+\-]+$/, "Use apenas números"),
});

type FormData = z.infer<typeof schema>;

/* ------------------------------ phone helpers ----------------------------- */

function formatPhoneBR(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* --------------------------------- page ---------------------------------- */

function WppPage() {
  const { data: settings = DEFAULT_SETTINGS } = useSiteSettings();
  const [form, setForm] = useState<FormData>({ nome: "", telefone: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Attribution + trackers
  useEffect(() => {
    persistFirstTouch();
  }, []);

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

  const mutation = useMutation({
    mutationFn: async (payload: FormData) => {
      const attr = getPersistedAttribution();
      const eventId = `wpp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const insertPayload = {
        nome: payload.nome.trim(),
        telefone: payload.telefone.trim(),
        email: null,
        cidade: null,
        estado: null,
        valor_conta: null,
        mensagem: null,
        origem: attr.utm_source ? `wpp_${attr.utm_source}` : "wpp_direct",
        utm_source: attr.utm_source ?? null,
        utm_medium: attr.utm_medium ?? null,
        utm_campaign: attr.utm_campaign ?? null,
        utm_term: attr.utm_term ?? null,
        utm_content: attr.utm_content ?? null,
        gclid: attr.gclid ?? null,
        fbclid: attr.fbclid ?? null,
        fbp: attr.fbp ?? null,
        fbc: attr.fbc ?? null,
        page_url: attr.page_url ?? null,
        referrer: attr.referrer ?? null,
        user_agent: attr.user_agent ?? null,
      };
      const { error } = await supabase.from("leads").insert(insertPayload);
      if (error) throw error;
      return { eventId };
    },
    onSuccess: ({ eventId }) => {
      trackLeadConversion({
        adsId: settings.google_ads_id,
        adsLabel: settings.google_ads_conversion_label,
        value: 50,
        currency: "BRL",
        eventId,
      });
      const msg = `Olá! Meu nome é ${form.nome.trim()}. Quero saber mais sobre energia solar.`;
      window.location.href = waHref(settings.whatsapp, msg);
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao enviar. Tente novamente."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: Partial<Record<keyof FormData, string>> = {};
      parsed.error.errors.forEach((err) => {
        const k = err.path[0] as keyof FormData;
        if (!fe[k]) fe[k] = err.message;
      });
      setErrors(fe);
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  };

  const isPending = mutation.isPending || mutation.isSuccess;

  return (
    <main className="min-h-[100dvh] bg-gradient-hero flex flex-col">
      {/* Brand bar */}
      <header className="w-full bg-primary">
        <div className="mx-auto flex max-w-md items-center justify-center px-4 py-4">
          <img src={logoAsset.url} alt="LZ7 Energia" className="h-9 w-auto" width={110} height={36} />
        </div>
      </header>

      <section className="flex-1 flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <MessageCircle className="h-3.5 w-3.5" /> Atendimento no WhatsApp
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-foreground">
              Fale agora com um consultor
            </h1>
            <p className="text-sm text-muted-foreground">
              Preencha seus dados e continue direto no WhatsApp com um especialista em energia solar.
            </p>
          </div>

          <form
            onSubmit={submit}
            className="rounded-2xl border bg-card p-5 shadow-elegant space-y-4"
            noValidate
          >
            <div>
              <Label htmlFor="nome">Seu nome</Label>
              <Input
                id="nome"
                autoComplete="name"
                inputMode="text"
                placeholder="Ex: João Silva"
                value={form.nome}
                onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                aria-invalid={!!errors.nome}
                className="mt-1.5 h-12 text-base"
                disabled={isPending}
              />
              {errors.nome && <p className="mt-1 text-xs text-destructive">{errors.nome}</p>}
            </div>

            <div>
              <Label htmlFor="telefone">WhatsApp com DDD</Label>
              <Input
                id="telefone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="(11) 91234-5678"
                value={form.telefone}
                onChange={(e) => setForm((s) => ({ ...s, telefone: formatPhoneBR(e.target.value) }))}
                aria-invalid={!!errors.telefone}
                className="mt-1.5 h-12 text-base"
                disabled={isPending}
              />
              {errors.telefone && <p className="mt-1 text-xs text-destructive">{errors.telefone}</p>}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isPending}
              className="w-full h-12 text-base font-semibold bg-cta text-cta-foreground hover:bg-cta/90"
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Abrindo WhatsApp...</>
              ) : (
                <><MessageCircle className="h-5 w-5 mr-2" /> Falar no WhatsApp agora</>
              )}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Seus dados estão protegidos. Sem spam.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
