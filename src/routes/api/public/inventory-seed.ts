import { createFileRoute } from "@tanstack/react-router";

/** Rota temporária de carga inicial do inventário (só funciona com a tabela vazia). */
export const Route = createFileRoute("/api/public/inventory-seed")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { count } = await supabaseAdmin
          .from("inventory_items")
          .select("id", { count: "exact", head: true });
        if ((count ?? 0) > 0) return new Response("already seeded", { status: 409 });

        const res = await fetch(
          "https://docs.google.com/spreadsheets/d/1sXt5mnTugkI7iCdtFNqXxaP1iZRSJYUx4iwC-oeFYrg/export?format=csv&gid=0",
        );
        if (!res.ok) return new Response(`sheet ${res.status}`, { status: 502 });
        const text = (await res.text()).replace(/\r\n/g, "\n");

        const parse = (src: string) => {
          const rows: string[][] = [];
          let row: string[] = [];
          let cell = "";
          let quoted = false;
          for (let i = 0; i < src.length; i++) {
            const c = src[i];
            if (quoted) {
              if (c === '"') {
                if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
              } else cell += c;
            } else if (c === '"') quoted = true;
            else if (c === ",") { row.push(cell); cell = ""; }
            else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
            else cell += c;
          }
          if (cell.length || row.length) { row.push(cell); rows.push(row); }
          return rows;
        };
        const num = (raw: string | undefined) => {
          const s = (raw ?? "").replace(/R\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".").trim();
          if (!s || s === "-") return null;
          const n = Number(s);
          return Number.isFinite(n) ? n : null;
        };

        const rows = parse(text);
        const payload = rows.slice(1).flatMap((r, i) => {
          const codigo = (r[0] ?? "").trim();
          if (!codigo) return [];
          const compra = num(r[6]) ?? 0;
          return [{
            codigo,
            descricao: (r[1] ?? "").trim(),
            saldo_inventario: num(r[2]),
            saldo_fisico: num(r[3]) ?? 0,
            unidade: (r[4] ?? "UNID").trim() || "UNID",
            preco_venda: num(r[5]) ?? 0,
            preco_compra: compra,
            preco_compra_convertido: num(r[7]) ?? compra,
            prateleira: (r[8] ?? "").trim() || null,
            ordem: i,
          }];
        });

        const { error } = await supabaseAdmin
          .from("inventory_items")
          .upsert(payload as never, { onConflict: "codigo" });
        if (error) return new Response(error.message, { status: 500 });
        return new Response(JSON.stringify({ saved: payload.length }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
