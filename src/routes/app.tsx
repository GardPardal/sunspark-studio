import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Smartphone, ShieldCheck, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type DownloadInfo = {
  version: string | null;
  url: string | null;
  size_bytes: number | null;
  built_at: string | null;
  min_android: string;
};

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Baixar App do Consultor — LZ7 Energia" },
      { name: "description", content: "Baixe o aplicativo Android da LZ7 Energia e cadastre leads direto do celular, na rua ou no escritório." },
      { property: "og:title", content: "App do Consultor LZ7 Energia" },
      { property: "og:description", content: "APK oficial para consultores da LZ7 Energia gerenciarem leads no celular." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AppDownloadPage,
});

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function AppDownloadPage() {
  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/app-download.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: DownloadInfo) => setInfo(d))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);

  const absoluteUrl =
    info?.url && typeof window !== "undefined"
      ? new URL(info.url, window.location.origin).toString()
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary mb-4">
            <Smartphone className="h-3.5 w-3.5" /> App do Consultor
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Cadastre e gerencie leads pelo celular
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Baixe o app oficial da LZ7 Energia e trabalhe onde estiver — na rua,
            em visita ou no escritório. Mesmo login, mesmos dados do painel web.
          </p>
        </div>

        <Card className="p-8 md:p-10 grid gap-8 md:grid-cols-[1fr_auto] items-center">
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold">Android</h2>
              {loading ? (
                <p className="text-sm text-muted-foreground mt-1">Carregando informações…</p>
              ) : info?.url ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Versão {info.version} {info.size_bytes ? `· ${formatBytes(info.size_bytes)}` : ""} · Android {info.min_android}+
                </p>
              ) : (
                <p className="text-sm text-amber-700 mt-1 flex items-center gap-1.5">
                  <Info className="h-4 w-4" /> APK em preparação. Volte em alguns minutos.
                </p>
              )}
            </div>

            {info?.url ? (
              <Button asChild size="lg" className="h-14 text-base px-8">
                <a href={info.url} download>
                  <Download className="h-5 w-5 mr-2" />
                  Baixar App para Android
                </a>
              </Button>
            ) : (
              <Button size="lg" className="h-14 text-base px-8" disabled>
                <Download className="h-5 w-5 mr-2" />
                Baixar App para Android
              </Button>
            )}

            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">1</span>
                <span>Toque em <strong className="text-foreground">Baixar App</strong> pelo celular.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">2</span>
                <span>Abra o arquivo <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.apk</code> nas notificações. O Android pedirá para permitir instalação de "fontes desconhecidas" — permita.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">3</span>
                <span>Entre com seu login do painel LZ7 e comece a cadastrar leads.</span>
              </li>
            </ol>
          </div>

          {absoluteUrl ? (
            <div className="hidden md:flex flex-col items-center gap-2 border-l pl-8">
              <div className="rounded-lg bg-white p-3 border">
                <QRCodeSVG value={absoluteUrl} size={160} />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-[10rem]">
                Aponte a câmera do celular para baixar
              </p>
            </div>
          ) : null}
        </Card>

        <div className="grid gap-4 md:grid-cols-3 mt-8">
          <Card className="p-5">
            <ShieldCheck className="h-6 w-6 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Seguro</h3>
            <p className="text-sm text-muted-foreground">
              APK assinado oficialmente pela LZ7 Energia. Mesma autenticação do painel web.
            </p>
          </Card>
          <Card className="p-5">
            <Smartphone className="h-6 w-6 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Funciona na rua</h3>
            <p className="text-sm text-muted-foreground">
              Cadastre leads em campo direto do celular. Sincroniza com o painel em tempo real.
            </p>
          </Card>
          <Card className="p-5">
            <ExternalLink className="h-6 w-6 text-primary mb-2" />
            <h3 className="font-semibold mb-1">iPhone?</h3>
            <p className="text-sm text-muted-foreground">
              Ainda sem versão iOS. Use o painel pelo Safari em <a href="/coordenacao" className="text-primary underline">/coordenacao</a>.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
