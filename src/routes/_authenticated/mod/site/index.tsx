import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsBadge } from "@/components/ds/badge";
import { DsSkeletonList } from "@/components/ds/skeleton";
import { siteOverview, CMS_TABLES, INBOX_TABLES } from "@/modules/site/admin.functions";
import { CMS_SCHEMA, INBOX_SCHEMA } from "@/modules/site/cms.schema";
import { ExternalLink, Globe, Inbox, PenSquare, Radar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mod/site/")({
  head: () => ({
    meta: [
      { title: "CMS do Site — Solar OS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const fn = useServerFn(siteOverview);
  const q = useQuery({ queryKey: ["site_overview"], queryFn: () => fn() as any });
  const o = q.data as Record<string, number> | undefined;

  const stats: Array<{ label: string; value: number | undefined }> = [
    { label: "Artigos publicados", value: o?.publishedPosts },
    { label: "Projetos no portfólio", value: o?.projects },
    { label: "Vagas abertas", value: o?.openJobs },
    { label: "Inscritos na newsletter", value: o?.news },
  ];

  const pending = [
    { table: "job_applications" as const, count: o?.apps },
    { table: "partner_requests" as const, count: o?.partners },
    { table: "contact_messages" as const, count: o?.contacts },
  ];

  return (
    <ModuleShell title="Site LZ7" subtitle="Conteúdo do portal público e caixa de entrada" active="admin">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-bold">{q.isLoading ? "—" : (s.value ?? 0)}</p>
            </div>
          ))}
        </div>

        <Link
          to="/mod/site/radar"
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 transition hover:border-primary"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-display text-[15px] font-semibold">
              <Radar className="h-4 w-4 text-primary" /> Radar Editorial
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              A redação digital: encontra pautas, apura fontes e escreve os artigos do blog
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-primary">Abrir</span>
        </Link>

        <DsCard>
          <DsCardHeader title="Caixa de entrada" subtitle="Envios recebidos pelo site" />
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            {INBOX_TABLES.map((t) => {
              const s = INBOX_SCHEMA[t];
              const c = pending.find((p) => p.table === (t as any))?.count;
              return (
                <Link
                  key={t}
                  to="/mod/site/inbox/$table"
                  params={{ table: t }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background p-3 transition hover:border-primary/50"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Inbox className="h-4 w-4 text-sky-600" /> {s.label}
                  </span>
                  {c ? <DsBadge intent="danger">{c} novos</DsBadge> : <span className="text-xs text-muted-foreground">ver</span>}
                </Link>
              );
            })}
          </div>
        </DsCard>

        <DsCard>
          <DsCardHeader title="Conteúdo do site" subtitle="Edite sem precisar de código" />
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {CMS_TABLES.map((t) => {
              const s = CMS_SCHEMA[t];
              return (
                <Link
                  key={t}
                  to="/mod/site/gerenciar/$table"
                  params={{ table: t }}
                  className="rounded-xl border border-border/60 bg-background p-3 transition hover:border-primary/50"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <PenSquare className="h-4 w-4 text-primary" /> {s.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                </Link>
              );
            })}
          </div>
        </DsCard>

        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <Globe className="h-4 w-4" /> Abrir o site público <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </ModuleShell>
  );
}
