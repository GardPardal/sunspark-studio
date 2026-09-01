import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { registerAppServiceWorker } from "../lib/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  buildThemeCss,
  SiteSettingsProvider,
  siteSettingsQueryOptions,
  type SettingsMap,
} from "@/lib/site-settings";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente recarregar a página.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async ({ context }) => {
    try {
      const settings = await context.queryClient.ensureQueryData(siteSettingsQueryOptions());
      return { settings };
    } catch (error) {
      // Backend temporariamente indisponível: o site continua renderizando com os padrões.
      console.error("[root loader] falha ao carregar site_settings", error);
      return { settings: {} as SettingsMap };
    }
  },

  head: ({ loaderData }) => {
    const settings = loaderData?.settings;
    const themeColor = settings?.primary_color?.trim();
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...(themeColor ? [{ name: "theme-color", content: themeColor }] : []),
        {
          name: "google-site-verification",
          content: "0cabfnjvKWB14lZ7g_o_l3SYrINIIomo-NAEzV46Dtw",
        },
        { property: "og:site_name", content: "LZ7 Energia" },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "pt_BR" },
        { name: "twitter:card", content: "summary_large_image" },
        { title: "LZ7 Energia — Economize até 90% na conta de luz | Energia Solar PR, SP e SC" },
        {
          property: "og:title",
          content: "LZ7 Energia — Economize até 90% na conta de luz | Energia Solar PR, SP e SC",
        },
        {
          name: "twitter:title",
          content: "LZ7 Energia — Economize até 90% na conta de luz | Energia Solar PR, SP e SC",
        },
        {
          name: "description",
          content:
            "Reduza sua conta de energia em até 90% com um projeto solar personalizado da LZ7 Energia. Residencial, comercial, industrial e rural no Paraná, São Paulo e Santa Catarina. Solicite orçamento gratuito.",
        },
        {
          property: "og:description",
          content:
            "Reduza sua conta de energia em até 90% com um projeto solar personalizado da LZ7 Energia. Residencial, comercial, industrial e rural no Paraná, São Paulo e Santa Catarina. Solicite orçamento gratuito.",
        },
        {
          name: "twitter:description",
          content:
            "Reduza sua conta de energia em até 90% com um projeto solar personalizado da LZ7 Energia. Residencial, comercial, industrial e rural no Paraná, São Paulo e Santa Catarina. Solicite orçamento gratuito.",
        },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon.png" },
        { rel: "shortcut icon", href: "/favicon.png" },
        { rel: "apple-touch-icon", href: "/favicon.png" },
        { rel: "preconnect", href: "https://www.googletagmanager.com" },
        { rel: "preconnect", href: "https://www.google-analytics.com" },
        { rel: "dns-prefetch", href: "https://analytics.tiktok.com" },
        { rel: "dns-prefetch", href: "https://i.ytimg.com" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const loaderData = Route.useLoaderData({
    select: (d) => d as { settings?: SettingsMap } | undefined,
  });
  const settings = (loaderData?.settings ?? {}) as SettingsMap;

  const themeCss = buildThemeCss(settings);
  const customCss = settings.custom_css?.trim() ?? "";
  const customHead = settings.custom_head_html?.trim() ?? "";
  const customBody = settings.custom_body_html?.trim() ?? "";

  // Scripts inseridos via innerHTML não executam — recriamos cada <script> como
  // elemento novo para que tags coladas no painel (GA4, GTM, verificações) rodem de fato.
  const customHeadScript = customHead
    ? `(function(){var d=document,h=d.head,t=d.createElement('template');t.innerHTML=decodeURIComponent(${JSON.stringify(encodeURIComponent(customHead))});var nodes=Array.from(t.content.childNodes);nodes.forEach(function(n){if(n.nodeName==='SCRIPT'){var s=d.createElement('script');Array.from(n.attributes||[]).forEach(function(a){s.setAttribute(a.name,a.value)});s.text=n.textContent||'';h.appendChild(s)}else{h.appendChild(d.importNode(n,true))}});})();`
    : "";
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
        {customCss ? <style dangerouslySetInnerHTML={{ __html: customCss }} /> : null}
        {customHeadScript ? (
          <script dangerouslySetInnerHTML={{ __html: customHeadScript }} />
        ) : null}
      </head>
      <body>
        {children}
        {customBody ? <div dangerouslySetInnerHTML={{ __html: customBody }} /> : null}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { settings } = Route.useLoaderData();
  const router = useRouter();

  useEffect(() => {
    registerAppServiceWorker();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <SiteSettingsProvider initialSettings={settings}>
        <Outlet />
      </SiteSettingsProvider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
