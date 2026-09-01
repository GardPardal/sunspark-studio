import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { PublicLayout, PageHero, Section } from "@/components/site/public-layout";

const SEO_TITLE = "Calculadora de Parcelamento e Taxas — LZ7 Energia";
const SEO_DESCRIPTION =
  "Simule o valor das parcelas, a taxa cobrada e o valor líquido a receber em vendas no cartão de crédito ou débito.";

/** Taxas de antecipação/administração por número de parcelas (% sobre o valor da venda). */
const RATES: Array<{ key: string; label: string; installments: number; rate: number }> = [
  { key: "debito", label: "Débito", installments: 1, rate: 0.83 },
  ...Array.from({ length: 21 }, (_, i) => i + 1).map((n) => ({
    key: `${n}x`,
    label: `${n}x`,
    installments: n,
    rate: [
      3.41, 4.63, 5.47, 6.27, 7.08, 7.93, 9.0, 9.85, 10.72, 11.56, 12.4, 13.27, 14.14, 14.94, 15.88,
      16.76, 17.58, 18.45, 19.28, 20.17, 21.16,
    ][n - 1],
  })),
];

export const Route = createFileRoute("/calculadora")({
  head: () => ({
    meta: [
      { title: SEO_TITLE },
      { name: "description", content: SEO_DESCRIPTION },
      { property: "og:title", content: SEO_TITLE },
      { property: "og:description", content: SEO_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SEO_TITLE },
      { name: "twitter:description", content: SEO_DESCRIPTION },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "https://lz7energia.com.br/calculadora" }],
  }),
  component: CalculadoraPage,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

function CalculadoraPage() {
  const [rawValue, setRawValue] = useState("10000");
  const [index, setIndex] = useState(12); // 12 = 12x (0 = débito)
  const [passOn, setPassOn] = useState(false);

  const option = RATES[index];
  const amount = Number(rawValue.replace(/\./g, "").replace(",", ".")) || 0;

  const result = useMemo(() => {
    const rate = option.rate / 100;
    if (passOn) {
      // Cliente paga a taxa: valor cobrado sobe para que o líquido seja o valor desejado.
      const charged = rate >= 1 ? 0 : amount / (1 - rate);
      return {
        charged,
        fee: charged - amount,
        net: amount,
        installment: charged / option.installments,
      };
    }
    const fee = amount * rate;
    return {
      charged: amount,
      fee,
      net: amount - fee,
      installment: amount / option.installments,
    };
  }, [amount, option, passOn]);

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Ferramenta interna"
        title="Calculadora de parcelamento"
        subtitle="Informe o valor da venda, arraste o termômetro de parcelas e veja na hora a taxa, o valor de cada parcela e quanto você recebe."
        breadcrumbs={[{ label: "Calculadora" }]}
      />

      <Section tone="muted">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Entradas */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm md:p-8">
            <label htmlFor="valor" className="block text-sm font-semibold text-foreground">
              Valor da venda
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 focus-within:border-primary">
              <span className="font-display text-lg font-semibold text-muted-foreground">R$</span>
              <input
                id="valor"
                inputMode="decimal"
                value={rawValue}
                onChange={(e) => setRawValue(e.target.value.replace(/[^\d.,]/g, "").slice(0, 12))}
                className="w-full bg-transparent font-display text-2xl font-bold outline-none"
                placeholder="0,00"
              />
            </div>

            <div className="mt-8">
              <div className="flex items-end justify-between gap-4">
                <label htmlFor="parcelas" className="text-sm font-semibold text-foreground">
                  Forma de pagamento
                </label>
                <span className="font-display text-3xl font-bold text-primary">{option.label}</span>
              </div>
              <input
                id="parcelas"
                type="range"
                min={0}
                max={RATES.length - 1}
                step={1}
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
                className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                style={{
                  background: `linear-gradient(to right, hsl(var(--primary)) ${(index / (RATES.length - 1)) * 100}%, hsl(var(--muted)) ${(index / (RATES.length - 1)) * 100}%)`,
                }}
                aria-valuetext={`${option.label} — taxa ${option.rate.toString().replace(".", ",")}%`}
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Débito</span>
                <span>21x</span>
              </div>
            </div>

            <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
              <input
                type="checkbox"
                checked={passOn}
                onChange={(e) => setPassOn(e.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span className="text-sm">
                <span className="font-semibold">Repassar a taxa ao cliente</span>
                <span className="block text-muted-foreground">
                  O valor cobrado sobe para que você receba exatamente o valor informado.
                </span>
              </span>
            </label>
          </div>

          {/* Resultado */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-navy-deep p-6 text-white shadow-lg md:p-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                {option.key === "debito"
                  ? "Pagamento à vista no débito"
                  : `Parcela em ${option.label}`}
              </p>
              <p className="mt-2 font-display text-4xl font-bold">{brl(result.installment)}</p>
              {option.installments > 1 ? (
                <p className="mt-1 text-sm text-white/70">
                  {option.installments}x de {brl(result.installment)}
                </p>
              ) : null}
              <div className="mt-6 grid gap-3 border-t border-white/15 pt-5 text-sm">
                <Row label="Valor cobrado do cliente" value={brl(result.charged)} />
                <Row
                  label={`Taxa (${option.rate.toString().replace(".", ",")}%)`}
                  value={`- ${brl(result.fee)}`}
                />
                <Row label="Você recebe" value={brl(result.net)} strong />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <div className="grid grid-cols-2 bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Parcela</span>
                <span className="text-right">Taxa</span>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {RATES.map((r, i) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`grid w-full grid-cols-2 items-center px-4 py-2 text-sm transition ${
                      i === index ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted/40"
                    }`}
                  >
                    <span className="text-left">{r.label}</span>
                    <span className="text-right tabular-nums">
                      {r.rate.toFixed(2).replace(".", ",")}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Taxas de administração/antecipação da maquininha. Valores simulados, sujeitos a
              confirmação da adquirente.
            </p>
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "text-white" : "text-white/70"}>{label}</span>
      <span className={strong ? "font-display text-lg font-bold text-lzgreen" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}
