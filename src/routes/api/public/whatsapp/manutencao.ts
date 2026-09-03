import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { defaultOrgId } from "@/lib/wa-ingest.server";
import { getZApiConfig } from "@/lib/zapi.server";

/**
 * Rotina de manutenção do WhatsApp (reparo do histórico e sincronização de
 * identidade). Endpoint público por prefixo: exige o segredo da integração.
 */
export const Route = createFileRoute("/api/public/whatsapp/manutencao")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = getZApiConfig().clientToken;
        const supplied =
          request.headers.get("client-token") || request.headers.get("x-zapi-token");
        if (!supplied || supplied !== expected) {
          return new Response("forbidden", { status: 403 });
        }

        const url = new URL(request.url);
        const acoes = (url.searchParams.get("acoes") ?? "tudo").split(",");
        const fazer = (a: string) => acoes.includes("tudo") || acoes.includes(a);

        const orgId = await defaultOrgId(supabaseAdmin as never);
        if (!orgId) return new Response("no org", { status: 503 });

        const {
          reingestPreservedEvents,
          removeLegacyPlaceholders,
          recalcConversations,
          countEmptyConversations,
          repairContactIdentities,
          mergeLegacyLidContacts,
        } = await import("@/lib/wa-repair.server");
        const { syncWaDirectory } = await import("@/lib/wa-identity.server");

        const relatorio: Record<string, unknown> = {};

        if (fazer("agenda")) {
          relatorio.agenda = await syncWaDirectory(supabaseAdmin, orgId);
        }
        if (fazer("merge")) {
          relatorio.merge = await mergeLegacyLidContacts(supabaseAdmin, orgId);
        }
        if (fazer("identidades")) {
          relatorio.identidades = await repairContactIdentities(
            supabaseAdmin,
            orgId,
            url.searchParams.get("fotos") !== "0",
          );
        }
        if (fazer("reingest")) {
          relatorio.reingest = await reingestPreservedEvents(supabaseAdmin, orgId, 2000);
        }
        if (fazer("placeholders")) {
          relatorio.placeholdersRemovidos = await removeLegacyPlaceholders(supabaseAdmin, orgId);
        }
        if (fazer("recalcular")) {
          relatorio.conversasAtualizadas = await recalcConversations(supabaseAdmin, orgId);
          relatorio.conversasSemMensagem = await countEmptyConversations(supabaseAdmin, orgId);
        }
        if (fazer("conhecimento")) {
          const { syncConversationsToLizKnowledgeServer } = await import("@/lib/wa-knowledge.server");
          relatorio.conhecimento = await syncConversationsToLizKnowledgeServer();
        }

        return new Response(JSON.stringify(relatorio, null, 2), {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
