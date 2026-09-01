import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { PublicLayout, PageHero, Section, EmptyState } from "@/components/site/public-layout";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listUnits } from "@/modules/site/public.functions";

const unitsQuery = { queryKey: ["site_units"], queryFn: () => listUnits(), staleTime: 5 * 60_000 };

const TITLE = "Unidades LZ7 Energia — onde estamos";
const DESCRIPTION =
  "Endereços, telefones e horários das unidades da LZ7 Energia no Paraná e em São Paulo.";
const URL = "https://lz7energia.com.br/unidades";

export const Route = createFileRoute("/unidades")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(unitsQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: Page,
});

function Page() {
  const { data: units } = useSuspenseQuery(unitsQuery);
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Atendimento"
        title="Nossas unidades"
        subtitle="Equipe local perto de você, em todas as regiões onde atuamos."
        breadcrumbs={[{ label: "Unidades" }]}
      />
      <Section>
        {units.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((u) => (
              <div key={u.id} className="rounded-2xl border border-border bg-white p-6">
                <h2 className="font-display text-lg font-semibold">{u.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[u.address, u.city, u.state].filter(Boolean).join(", ")}
                </p>
                {u.phone ? <p className="mt-1 text-sm text-muted-foreground">{u.phone}</p> : null}
                {u.hours ? <p className="mt-1 text-sm text-muted-foreground">{u.hours}</p> : null}
                {u.maps_url ? (
                  <a
                    href={u.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-semibold text-lzgreen-strong hover:underline"
                  >
                    Ver no mapa
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Unidades em atualização"
            description="Fale com a gente pelo WhatsApp e direcionamos você ao time mais próximo."
          />
        )}
      </Section>
    </PublicLayout>
  );
}
