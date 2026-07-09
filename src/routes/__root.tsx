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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Algo deu errado
        </h1>
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
    const settings = await context.queryClient.ensureQueryData(siteSettingsQueryOptions());
    return { settings };
  },
  head: ({ loaderData }) => {
    const settings = loaderData?.settings;
    const faviconHref = settings?.logo_url?.trim();
    const themeColor = settings?.primary_color?.trim();
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...(themeColor ? [{ name: "theme-color", content: themeColor }] : []),
        { property: "og:site_name", content: "LZ7 Energia" },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "pt_BR" },
        { name: "twitter:card", content: "summary_large_image" },
        { title: "LZ7 Energia — Economize até 90% na conta de luz | Energia Solar PR, SP e SC" },
        { property: "og:title", content: "LZ7 Energia — Economize até 90% na conta de luz | Energia Solar PR, SP e SC" },
        { name: "twitter:title", content: "LZ7 Energia — Economize até 90% na conta de luz | Energia Solar PR, SP e SC" },
        { name: "description", content: "Reduza sua conta de energia em até 90% com um projeto solar personalizado da LZ7 Energia. Residencial, comercial, industrial e rural no Paraná, São Paulo e Santa Catarina. Solicite orçamento gratuito." },
        { property: "og:description", content: "Reduza sua conta de energia em até 90% com um projeto solar personalizado da LZ7 Energia. Residencial, comercial, industrial e rural no Paraná, São Paulo e Santa Catarina. Solicite orçamento gratuito." },
        { name: "twitter:description", content: "Reduza sua conta de energia em até 90% com um projeto solar personalizado da LZ7 Energia. Residencial, comercial, industrial e rural no Paraná, São Paulo e Santa Catarina. Solicite orçamento gratuito." },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/pwa-192.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "preload",
          as: "style",
          href: "https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600&family=Playfair+Display:wght@700;800;900&display=swap",
        },
        ...(faviconHref ? [{ rel: "icon", href: faviconHref }] : []),
      ],
      scripts: [
        {
          children:
            "(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600&family=Playfair+Display:wght@700;800;900&display=swap';document.head.appendChild(l);})();",
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const { settings } = Route.useLoaderData();
  const themeCss = buildThemeCss(settings);
  const customCss = settings.custom_css?.trim() ?? "";
  const customHead = settings.custom_head_html?.trim() ?? "";
  const customBody = settings.custom_body_html?.trim() ?? "";
  const customHeadScript = customHead
    ? `(function(){var d=document,h=d.head,t=d.createElement('template');t.innerHTML=decodeURIComponent(${JSON.stringify(encodeURIComponent(customHead))});h.appendChild(t.content);})();`
    : "";
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
        {customCss ? <style dangerouslySetInnerHTML={{ __html: customCss }} /> : null}
        {customHeadScript ? <script dangerouslySetInnerHTML={{ __html: customHeadScript }} /> : null}
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

