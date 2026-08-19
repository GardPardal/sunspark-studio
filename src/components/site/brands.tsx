import { BRANDS } from "./home-content";

export function Brands() {
  return (
    <section id="projetos" className="bg-white py-12 md:py-16">
      <div className="mx-auto max-w-[1320px] px-4 md:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Marcas que trabalhamos
        </p>
        <ul className="mt-7 grid grid-cols-2 items-center gap-x-6 gap-y-6 sm:grid-cols-4 lg:grid-cols-7">
          {BRANDS.map((brand) => (
            <li
              key={brand}
              className="text-center font-display text-sm font-bold tracking-tight text-navy/70 transition hover:text-navy md:text-base"
            >
              {brand}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
