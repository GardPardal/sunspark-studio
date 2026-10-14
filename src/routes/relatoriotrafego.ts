import { createFileRoute } from "@tanstack/react-router";
import modelo from "@/content/relatorio-trafego.html?raw";

// Relatório comercial do tráfego pago (auditoria de cards, unidades, vendedores, cadência).
// O HTML é só o modelo; os números ficam em site_settings ("relatorio:trafego"),
// enviados por /api/public/relatorio-trafego — dados de clientes não vão para o repositório.

const CHAVE = "relatorio:trafego";

const pagina = (html: string, status = 200) =>
  new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });

const noScript = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

export const Route = createFileRoute("/relatoriotrafego")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("site_settings")
          .select("value")
          .eq("key", CHAVE)
          .maybeSingle();
        let salvo: { dados?: unknown; comp?: unknown } | null = null;
        try {
          salvo = data?.value ? JSON.parse(data.value as string) : null;
        } catch {
          salvo = null;
        }
        if (!salvo?.dados || !salvo?.comp) {
          return pagina(
            '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Relatório de tráfego</title></head><body style="font-family:system-ui;padding:24px">Relatório ainda não publicado.</body></html>',
            404,
          );
        }
        const html = (modelo as string)
          .replace("__DADOS__", () => noScript(salvo.dados))
          .replace("__COMP__", () => noScript(salvo.comp));
        return pagina(html);
      },
    },
  },
});
