import { useMemo, useState } from "react";
import { CITIES, PROPERTY_TYPES, SIMULATOR } from "./home-content";
import { WhatsAppIcon } from "./icons";
import { WhatsAppGate } from "./whatsapp-gate";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

export function SavingsSimulator({ whatsapp }: { whatsapp: string }) {
  const [consumo, setConsumo] = useState("500");
  const [tipo, setTipo] = useState<string>(PROPERTY_TYPES[0].value);
  const [cidade, setCidade] = useState("");

  const result = useMemo(() => {
    const kwh = Math.max(0, Number(consumo.replace(/\D/g, "")) || 0);
    const factor = PROPERTY_TYPES.find((t) => t.value === tipo)?.factor ?? 1;
    const economiaAno = kwh * SIMULATOR.tarifaKwh * 12 * SIMULATOR.economiaPercentual * factor;
    const kwp = kwh / SIMULATOR.geracaoMensalPorKwp;
    const investimento = kwp * SIMULATOR.custoPorKwp;
    const payback = economiaAno > 0 ? Math.max(2, Math.round(investimento / economiaAno)) : 0;
    return { economiaAno, payback };
  }, [consumo, tipo]);

  return (
    <section id="solucoes" className="bg-[oklch(0.975_0.004_248)] py-16 md:py-24">
      <div className="mx-auto max-w-[980px] px-4 md:px-8">
        <div className="rounded-3xl bg-white p-6 shadow-[0_28px_70px_-45px_oklch(0.2_0.04_248)] ring-1 ring-black/5 md:p-10">
          <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-navy-deep md:text-3xl">
            Quanto você pode economizar?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
            Faça uma simulação gratuita e descubra quanto pode economizar na sua conta de luz.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="sim-consumo" className="text-xs font-semibold text-navy-deep">
                Consumo médio (kWh/mês)
              </label>
              <input
                id="sim-consumo"
                inputMode="numeric"
                value={consumo}
                onChange={(e) => setConsumo(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-base text-navy-deep outline-none transition focus:border-lzgreen focus:ring-2 focus:ring-lzgreen/25"
              />
            </div>
            <div>
              <label htmlFor="sim-tipo" className="text-xs font-semibold text-navy-deep">
                Tipo de imóvel
              </label>
              <select
                id="sim-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-base text-navy-deep outline-none transition focus:border-lzgreen focus:ring-2 focus:ring-lzgreen/25"
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sim-cidade" className="text-xs font-semibold text-navy-deep">
                Cidade
              </label>
              <select
                id="sim-cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-base text-navy-deep outline-none transition focus:border-lzgreen focus:ring-2 focus:ring-lzgreen/25"
              >
                <option value="">Selecione sua cidade</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="mt-6 grid gap-4 rounded-2xl bg-[oklch(0.97_0.008_150)] p-5 text-center sm:grid-cols-2 sm:divide-x sm:divide-black/10"
            aria-live="polite"
          >
            <div>
              <p className="text-xs text-muted-foreground">Sua economia estimada</p>
              <p className="font-display text-2xl font-extrabold text-lzgreen-strong md:text-3xl">
                {brl.format(result.economiaAno)}/ano
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Retorno do investimento</p>
              <p className="font-display text-lg font-bold text-navy-deep md:text-xl">
                em até {result.payback || "—"} anos
              </p>
            </div>
          </div>

          <WhatsAppGate
            whatsapp={whatsapp}
            location="simulador"
            className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl bg-lzgreen px-6 py-4 font-display text-base font-semibold text-navy-deep transition hover:bg-lzgreen-strong hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lzgreen"
          >
            Quero economizar também <WhatsAppIcon className="h-5 w-5" />
          </WhatsAppGate>

          <p className="mt-3 text-center text-[11px] leading-snug text-muted-foreground">
            {SIMULATOR.disclaimer}
          </p>
        </div>
      </div>
    </section>
  );
}
