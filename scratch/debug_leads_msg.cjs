const { createClient } = require("@supabase/supabase-js");

async function check() {
  const sb = createClient("https://dwwospznutfbxcbbcqfa.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3d29zcHpudXRmYnhjYmJjcWZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTA4MDgsImV4cCI6MjA5ODkyNjgwOH0.S-pUCNquKJAy83OnuOLokcvB2MlZYT6CibN1ufPbY_M");

  console.log("Checking leads with observations or notes...");
  const { data: leads } = await sb.from("leads").select("id, nome, telefone, mensagem, valor_conta, sale_notes, padrao_eletrico, cidade").limit(20);
  console.log("Leads count:", leads?.length);
  if (leads) {
    for (const l of leads) {
      console.log(`Lead: ${l.nome} (${l.telefone}): msg="${l.mensagem}", notes="${l.sale_notes}", valor="${l.valor_conta}"`);
    }
  }
}
check().catch(console.error);