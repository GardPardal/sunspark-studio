import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-cleanup-resumes")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("resumes").remove([
          "2026/cc04e695-686a-4d10-ab05-9becdf080e2e.pdf",
          "2026/cd547458-ecb4-4f66-88fc-0b46d5b53b87.pdf",
        ]);
        return Response.json({ ok: !error, data, error: error?.message ?? null });
      },
    },
  },
});
