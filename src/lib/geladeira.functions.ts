import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EstadoGeladeira = "geladeira" | "vai_entrar" | "risco" | "livre";

export type VendedorGeladeira = {
  id: number;
  nome: string;
  estado: EstadoGeladeira;
  /** Data em que sai da geladeira (só quando estado = geladeira). */
  ate: string | null;
  parados: Array<{ dealId: number; nome: string; dias: number }>;
  daVez: boolean;
};

export type UnidadeGeladeira = {
  base: "londrina" | "wenceslau_braz" | "ponta_grossa";
  nome: string;
  vendedores: VendedorGeladeira[];
};

const NOME_UNIDADE = {
  londrina: "Londrina",
  wenceslau_braz: "Wenceslau Braz",
  ponta_grossa: "Ponta Grossa",
} as const;

/**
 * Geladeira da roleta do quiz: quem está penalizado, quem entra no próximo lead
 * e quem está perto do limite. Mesmo critério da roleta (ploomes-sync.server).
 */
export const getGeladeira = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const {
      ROLETA_QUIZ,
      ROLETA_PENALIDADE,
      NOMES_ROLETA,
      leadsParadosPorVendedor,
      penalidadesAtivas,
      ultimoDaRoleta,
    } = await import("@/lib/leads/ploomes-sync.server");
    const todos = Object.values(ROLETA_QUIZ).flat();
    const [parados, ativas] = await Promise.all([
      leadsParadosPorVendedor(todos),
      penalidadesAtivas(todos),
    ]);
    const unidades: UnidadeGeladeira[] = [];
    for (const base of ["londrina", "wenceslau_braz", "ponta_grossa"] as const) {
      const fila = ROLETA_QUIZ[base];
      const vendedores: VendedorGeladeira[] = fila.map((id) => {
        const p = (parados.get(id) ?? []).sort((a, b) => b.dias - a.dias);
        const estado: EstadoGeladeira = ativas.has(id)
          ? "geladeira"
          : p.length >= ROLETA_PENALIDADE.abandonados
            ? "vai_entrar"
            : p.length
              ? "risco"
              : "livre";
        return {
          id,
          nome: NOMES_ROLETA[id] ?? String(id),
          estado,
          ate: ativas.get(id) ?? null,
          parados: p,
          daVez: false,
        };
      });
      // Quem recebe o próximo lead: o primeiro depois do último que pode receber.
      const ultimo = fila.indexOf(Number(await ultimoDaRoleta(base)));
      for (let k = 1; k <= fila.length; k++) {
        const v = vendedores[(ultimo + k) % fila.length];
        if (v.estado === "livre" || v.estado === "risco") {
          v.daVez = true;
          break;
        }
      }
      unidades.push({ base, nome: NOME_UNIDADE[base], vendedores });
    }
    return {
      unidades,
      regra: ROLETA_PENALIDADE,
      lidoEm: new Date().toISOString(),
    };
  });
