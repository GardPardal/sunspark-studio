const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

function loadEnv() {
  const lines = fs.readFileSync(".env", "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[trimmed.slice(0, idx).trim()] = v;
    }
  }
}
loadEnv();

async function inspect() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

  console.log("Checking tables...");
  const tables = ["leads", "quiz_leads", "contacts", "wa_conversations", "wa_contacts", "wa_messages", "whatsapp_conversations"];
  for (const t of tables) {
    const { data, error, count } = await sb.from(t).select("*", { count: "exact" }).limit(5);
    console.log(`Table '${t}': ${count !== null ? count : data?.length} rows (error: ${error?.message})`);
    if (data && data.length > 0) {
      console.log(`  Sample:`, data[0]);
    }
  }
}

inspect().catch(console.error);