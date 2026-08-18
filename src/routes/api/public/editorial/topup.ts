import { createFileRoute } from "@tanstack/react-router";
import { runRegionalCycle } from "@/modules/editorial/regional.server";

const COOLDOWN_MS = 12 * 60_000; // 12 min entre reabastecimentos
const MIN_POSTS = 60; // abaixo disso sempre reabastece

/**
 * Reabastecimento automático do blog: chamado pela página quando o leitor
 * chega perto do fim da lista. Trabalho limitado + trava por cooldown.
 */
export const Route = createFileRoute("/api/public/editorial/topup")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");

          // single-flight: última execução recente bloqueia nova rodada
          const { data: last } = await sb
            .from("editorial_runs")
            .select("created_at")
            .eq("tipo", "topup")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (last?.created_at && Date.now() - new Date(last.created_at).getTime() < COOLDOWN_MS) {
            return Response.json({ ok: true, skipped: "cooldown" });
          }

          const { count } = await sb
            .from("site_posts")
            .select("id", { count: "exact", head: true })
            .eq("status", "publicado");

          await sb.from("editorial_runs").insert({ tipo: "topup", itens_encontrados: count ?? 0 });

          const result = await runRegionalCycle({ maxPosts: (count ?? 0) < MIN_POSTS ? 8 : 5, porFonte: 12 });
          return Response.json({ total: count ?? 0, ...result });
        } catch (e: any) {
          console.error("[editorial/topup]", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, info: "Reabastecimento do blog — use POST." }),
    },
  },
});
