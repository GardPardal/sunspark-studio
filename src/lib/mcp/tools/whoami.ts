import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function supabaseAs(ctx: ToolContext) {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "whoami",
  title: "Quem sou eu",
  description:
    "Retorna dados do usuário autenticado no painel LZ7 (id, email, unidade, papéis).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    const sb = supabaseAs(ctx);
    const uid = ctx.getUserId()!;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      sb.from("profiles").select("full_name,unit,status").eq("id", uid).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", uid),
    ]);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              user_id: uid,
              email: ctx.getUserEmail(),
              profile,
              roles: (roles ?? []).map((r) => r.role),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
});
