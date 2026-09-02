const { createClient } = require("@supabase/supabase-js");

const url = "https://dwwospznutfbxcbbcqfa.supabase.co";
// Using service role from server env or server client
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3d29zcHpudXRmYnhjYmJjcWZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM1MDgwOCwiZXhwIjoyMDk4OTI2ODA4fQ.m1VzD2Wv5b0kE8jGq-qVn9Z6P8h9X0u1v2w3x4y5z6A";

async function inspectTables() {
  const supabase = createClient(url, key);
  const { data: contacts } = await supabase.from("wa_contacts").select("*").limit(5);
  console.log("wa_contacts:", contacts?.length);
  
  const { data: msgs } = await supabase.from("wa_messages").select("id, direction, body, status, occurred_at").order("occurred_at", { ascending: false }).limit(10);
  console.log("Recent wa_messages:", msgs);
}

inspectTables();