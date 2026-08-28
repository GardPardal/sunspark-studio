import { createFileRoute } from "@tanstack/react-router";
import html from "@/content/dashhub.html?raw";

export const Route = createFileRoute("/dashhub")({
  server: {
    handlers: {
      GET: () =>
        new Response(html as string, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60",
            "X-Robots-Tag": "noindex, nofollow",
          },
        }),
    },
  },
});
