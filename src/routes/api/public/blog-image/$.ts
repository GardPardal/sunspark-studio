import { createFileRoute } from "@tanstack/react-router";

/** Serve as capas do bucket privado blog-media com cache longo. */
export const Route = createFileRoute("/api/public/blog-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as any)._splat as string;
        if (!path || path.includes("..")) return new Response("Not found", { status: 404 });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.storage.from("blog-media").download(path);
          if (error || !data) return new Response("Not found", { status: 404 });
          const buf = await data.arrayBuffer();
          return new Response(buf, {
            headers: {
              "content-type": data.type || "image/png",
              "cache-control": "public, max-age=31536000, immutable",
            },
          });
        } catch (e) {
          console.error("[blog-image]", e);
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
