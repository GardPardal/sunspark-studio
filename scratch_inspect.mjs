import { createClient } from "@supabase/supabase-js";
import fs from "fs";

async function main() {
  const envContent = fs.readFileSync(".env", "utf8");
  let url = "";
  let key = "";

  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("VITE_SUPABASE_URL=")) {
      url = trimmed.split("=")[1].replace(/["']/g, "").trim();
    }
    if (trimmed.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
      key = trimmed.split("=")[1].replace(/["']/g, "").trim();
    }
    if (!key && trimmed.startsWith("VITE_SUPABASE_ANON_KEY=")) {
      key = trimmed.split("=")[1].replace(/["']/g, "").trim();
    }
  }

  if (!url || !key) {
    console.error("Missing Supabase credentials in .env");
    return;
  }

  const supabase = createClient(url, key);

  // Buscar todos os leads das últimas 48 horas
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, nome, telefone, cidade, estado, valor_conta, origem, external_id, external_source, created_at, mensagem, utm_campaign, utm_source",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase error:", error);
    return;
  }

  console.log(`Encontrados ${leads?.length ?? 0} leads nas últimas 48h (desde ${since}):`);
  for (const l of leads ?? []) {
    console.log(
      JSON.stringify({
        id: l.id,
        created_at: l.created_at,
        nome: l.nome,
        telefone: l.telefone,
        cidade: l.cidade,
        estado: l.estado,
        valor_conta: l.valor_conta,
        origem: l.origem,
        external_id: l.external_id,
        external_source: l.external_source,
      }),
    );
  }
}

main().catch(console.error);
