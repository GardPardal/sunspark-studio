import { Link } from "@tanstack/react-router";

import { baseMaisProxima, cidadesPrioritarias } from "@/lib/local-seo";

type Props = {
  /** "section" = bloco completo (home) | "compact" = faixa de links (blog) */
  variant?: "section" | "compact";
  title?: string;
  className?: string;
};

/**
 * Bloco de links internos para as cidades prioritárias de SEO local.
 * Reforça a indexação dessas páginas com links de dentro do conteúdo,
 * e não apenas do rodapé.
 */
export function CitiesLinks({ variant = "section", title, className = "" }: Props) {
  const cidades = cidadesPrioritarias();

  if (variant === "compact") {
    return (
      <nav
        aria-label="Cidades atendidas pela LZ7 Energia"
        className={`rounded-2xl border border-border bg-muted/40 p-5 ${className}`}
      >
        <p className="font-display text-sm font-semibold">Energia solar perto de você</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {cidades.map((c) => (
            <li key={c.slug}>
              <Link
                to="/energia-solar/$cidade"
                params={{ cidade: c.slug }}
                className="inline-flex rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium transition hover:border-lzgreen hover:text-lzgreen-strong"
              >
                {c.nome} - {c.uf}
              </Link>
            </li>
          ))}
          <li>
            <Link
              to="/energia-solar"
              className="inline-flex rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium transition hover:border-lzgreen hover:text-lzgreen-strong"
            >
              Ver todas as cidades
            </Link>
          </li>
        </ul>
      </nav>
    );
  }

  return (
    <section id="onde-atendemos" className={`bg-muted/40 py-16 md:py-20 ${className}`}>
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="font-display text-2xl font-bold md:text-3xl">
          {title ?? "Onde atendemos com equipe própria"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Operamos a partir de três bases no Paraná — Londrina, Ponta Grossa e Wenceslau Braz. Veja
          como funciona a instalação, a homologação e a economia estimada na sua cidade.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cidades.map((c) => {
            const { base, km } = baseMaisProxima(c);
            return (
              <Link
                key={c.slug}
                to="/energia-solar/$cidade"
                params={{ cidade: c.slug }}
                className="group rounded-2xl border border-border bg-white p-5 transition hover:border-lzgreen hover:shadow-md"
              >
                <p className="font-display text-base font-semibold group-hover:text-lzgreen-strong">
                  Energia solar em {c.nome}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.uf} · {c.concessionaria} · a {km} km da base de {base.cidade}
                </p>
              </Link>
            );
          })}
        </div>

        <Link
          to="/energia-solar"
          className="mt-8 inline-flex rounded-xl border border-border bg-white px-5 py-3 text-sm font-semibold transition hover:border-lzgreen hover:text-lzgreen-strong"
        >
          Ver todas as cidades atendidas
        </Link>
      </div>
    </section>
  );
}
