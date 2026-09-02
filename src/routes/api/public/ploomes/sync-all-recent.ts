import { createFileRoute } from "@tanstack/react-router";
import { pushLeadToPloomesForm, pushLeadToPloomesInternal } from "@/lib/ploomes.server";

export const Route = createFileRoute("/api/public/ploomes/sync-all-recent")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Busca todos os leads criados nos últimos 7 dias
          const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
          const { data: leads, error } = await supabaseAdmin
            .from("leads")
            .select("*")
            .gte("created_at", since)
            .order("created_at", { ascending: false });

          if (error) {
            return Response.json({ ok: false, error: error.message }, { status: 500 });
          }

          const results: Array<{
            id: string;
            nome: string;
            telefone: string;
            cidade: string | null;
            formStatus: number | string;
            apiStatus: boolean;
            created_at: string;
          }> = [];

          for (const l of leads ?? []) {
            // 1. Envia via Formulário Oficial do Ploomes
            const formRes = await pushLeadToPloomesForm({
              nome: l.nome,
              telefone: l.telefone,
              cidade: l.cidade,
              estado: l.estado,
              valor_conta: l.valor_conta,
              mensagem: l.mensagem,
              origem: l.origem || "quiz-site",
            });

            // 2. Envia via API Ploomes
            const apiRes = await pushLeadToPloomesInternal(l.id);

            results.push({
              id: l.id,
              nome: l.nome,
              telefone: l.telefone,
              cidade: l.cidade,
              formStatus: formRes.status ?? (formRes.ok ? 200 : "error"),
              apiStatus: apiRes.ok,
              created_at: l.created_at,
            });
          }

          return Response.json(
            {
              ok: true,
              total_sincronizados: results.length,
              leads: results,
            },
            { status: 200 },
          );
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});
