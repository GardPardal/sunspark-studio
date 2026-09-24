import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin, Zap, SunMedium, ShieldCheck, Crosshair, Loader2, CheckCircle2, MessageCircle } from "lucide-react";
import { siteSettingsQueryOptions, useResolvedSiteSettings, waHref } from "@/lib/site-settings";
import { PublicLayout, PageHero, Section } from "@/components/site/public-layout";
import { Button } from "@/components/ui/button";

const TITLE = "Identificação de Região e Localização | LZ7 Energia";
const DESCRIPTION = "Verificação automática de cobertura e atendimento de engenharia solar fotovoltaica para a sua localização.";
const URL = "https://lz7energia.com.br/location";

export const Route = createFileRoute("/location")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(siteSettingsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: LocationPage,
});

interface LocationInfo {
  city: string;
  region: string;
  country: string;
  ip: string;
  org: string;
  timezone: string;
}

function LocationPage() {
  const settings = useResolvedSiteSettings();
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function detectLocation() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (isMounted) {
          setLocation({
            city: data.city || "Sua Cidade",
            region: data.region_code || data.region || "PR",
            country: data.country_name || "Brasil",
            ip: data.ip || "Conexão Local",
            org: data.org || "Provedor Local",
            timezone: data.timezone || "America/Sao_Paulo",
          });
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setLocation({
            city: "Paraná e São Paulo",
            region: "PR/SP",
            country: "Brasil",
            ip: "Rede",
            org: "Internet",
            timezone: "America/Sao_Paulo",
          });
          setLoading(false);
        }
      }
    }

    detectLocation();
    return () => {
      isMounted = false;
    };
  }, []);

  const getDistribuidora = (region?: string) => {
    if (region === "SP") return "CPFL / Enel / Elektro";
    if (region === "SC") return "Celesc";
    if (region === "MG") return "Cemig";
    return "Copel (PR)";
  };

  const handleGpsRefinement = () => {
    if (!navigator.geolocation) {
      setGpsStatus("Geolocalização não suportada no navegador.");
      return;
    }
    setGpsStatus("Solicitando permissão de GPS...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsStatus(`GPS capturado: Lat ${pos.coords.latitude.toFixed(4)}, Lon ${pos.coords.longitude.toFixed(4)}`);
      },
      () => {
        setGpsStatus("Permissão de GPS não concedida. Mantendo localização aproximada.");
      }
    );
  };

  const regionalWhatsAppUrl = waHref(
    settings.whatsapp,
    `Olá! Acessei a página da LZ7 Energia da minha região em ${location?.city || "minha cidade"} - ${location?.region || "PR"} e gostaria de simular um projeto solar.`
  );

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Detecção Regional"
        title="Engenharia Solar na sua Região"
        subtitle="Identificação automática de cobertura e atendimento técnico local da LZ7 Energia."
        breadcrumbs={[{ label: "Localização" }]}
      />

      <Section>
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-xl">
            <div className="bg-slate-900 p-6 sm:p-8 text-white">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Identificação em Tempo Real
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Cobertura Ativa
                </span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                  <p className="mt-3 text-sm text-slate-300">Identificando rota de conexão...</p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-400">Região Detectada</span>
                    <h2 className="mt-1 font-display text-3xl font-extrabold text-white sm:text-4xl">
                      {location?.city} - {location?.region}
                    </h2>
                    <p className="text-sm text-slate-300">{location?.country}</p>
                  </div>

                  <div className="grid gap-3 pt-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Zap className="h-4 w-4 text-emerald-400" /> Distribuidora Local
                      </div>
                      <p className="mt-1 text-base font-bold text-white">{getDistribuidora(location?.region)}</p>
                      <span className="text-[11px] text-emerald-400">Homologação direta LZ7</span>
                    </div>

                    <div className="rounded-2xl bg-white/5 p-4 border border-white/10">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <SunMedium className="h-4 w-4 text-emerald-400" /> Potencial de Geração
                      </div>
                      <p className="mt-1 text-base font-bold text-white">4.85 a 5.10 kWh/m²/dia</p>
                      <span className="text-[11px] text-emerald-400">Excelente viabilidade solar</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-black/30 p-3 text-xs text-slate-400">
                    <p>• <b>IP:</b> {location?.ip} | <b>Provedor:</b> {location?.org}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8 space-y-4 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
                  <a href={regionalWhatsAppUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" />
                    Falar com Engenheiro da Região
                  </a>
                </Button>
                <Button variant="outline" size="lg" onClick={handleGpsRefinement} className="gap-2 text-xs">
                  <Crosshair className="h-4 w-4 text-emerald-600" />
                  Refinar com GPS (Opcional)
                </Button>
              </div>
              {gpsStatus && (
                <p className="text-center text-xs text-muted-foreground">{gpsStatus}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-white p-5">
              <Zap className="h-6 w-6 text-emerald-600 mb-2" />
              <h3 className="font-bold text-sm">Homologação Local</h3>
              <p className="mt-1 text-xs text-muted-foreground">Engenharia própria com entrada rápida junto à distribuidora de energia.</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5">
              <ShieldCheck className="h-6 w-6 text-emerald-600 mb-2" />
              <h3 className="font-bold text-sm">Garantia de 25 Anos</h3>
              <p className="mt-1 text-xs text-muted-foreground">Módulos fotovoltaicos Tier-1 com garantia de geração e eficiência.</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-5">
              <MapPin className="h-6 w-6 text-emerald-600 mb-2" />
              <h3 className="font-bold text-sm">Privacidade LGPD</h3>
              <p className="mt-1 text-xs text-muted-foreground">Localização por rede utilizada estritamente para estimativa técnica regional.</p>
            </div>
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
