import { createFileRoute } from "@tanstack/react-router";
import {
  DsButton,
  DsCard,
  DsCardHeader,
  DsCardFooter,
  DsBadge,
  DsCount,
  DsAlert,
  DsEmpty,
  DsSkeleton,
  DsSkeletonList,
  DsPageHeader,
  DsSection,
  DsStat,
} from "@/components/ds";
import { Sun, Zap, Users, TrendingUp, Inbox, Bell } from "lucide-react";
import { BackendShellFrame, BackendTopBar } from "@/components/backend-shell";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mod/design-system")({
  head: () => ({
    meta: [
      { title: "Design System v2 — Solar OS" },
      { name: "description", content: "Catálogo vivo do Solar OS Design System v2: tokens, primitivos, estados." },
    ],
  }),
  component: DesignSystemCatalog,
});

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function DesignSystemCatalog() {
  return (
    <BackendShellFrame>
      <BackendTopBar title="Design System v2" subtitle="Solar OS · catálogo vivo" />
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <DsPageHeader
          title="Design System v2"
          subtitle="Vocabulário visual único. Toda nova tela do Solar OS consome esses primitivos."
          status="ativo"
          statusIntent="success"
          primary={<DsButton intent="primary" size="md" leadingIcon={<Zap className="h-4 w-4" />}>Ação primária</DsButton>}
          secondary={<DsButton intent="neutral" emphasis="outline" size="md">Secundária</DsButton>}
        />

        {/* Tokens de cor */}
        <DsSection title="Cores semânticas">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(["neutral", "primary", "success", "warning", "danger", "info", "accent"] as const).map((i) => (
              <DsCard key={i} level={1} className="!p-4">
                <div className={`mb-3 h-16 rounded-xl bg-${i === "neutral" ? "muted" : i}`} />
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{i}</div>
                <div className="mt-2 flex gap-2">
                  <DsBadge intent={i}>soft</DsBadge>
                </div>
              </DsCard>
            ))}
          </div>
        </DsSection>

        {/* Botões */}
        <DsSection title="Botões — intent × emphasis × size">
          <div className="space-y-4">
            <Row>
              <DsButton intent="primary" emphasis="solid">Primary solid</DsButton>
              <DsButton intent="primary" emphasis="soft">Primary soft</DsButton>
              <DsButton intent="primary" emphasis="outline">Primary outline</DsButton>
              <DsButton intent="primary" emphasis="ghost">Primary ghost</DsButton>
            </Row>
            <Row>
              <DsButton intent="success">Success</DsButton>
              <DsButton intent="warning">Warning</DsButton>
              <DsButton intent="danger">Danger</DsButton>
              <DsButton intent="info">Info</DsButton>
              <DsButton intent="neutral" emphasis="outline">Neutral</DsButton>
            </Row>
            <Row>
              <DsButton size="sm">Small</DsButton>
              <DsButton size="md">Medium</DsButton>
              <DsButton size="lg" intent="primary">Large (mobile primary)</DsButton>
              <DsButton loading>Loading</DsButton>
              <DsButton disabled>Disabled</DsButton>
            </Row>
          </div>
        </DsSection>

        {/* Badges */}
        <DsSection title="Badges e contadores">
          <Row>
            <DsBadge intent="neutral" dot>Neutral</DsBadge>
            <DsBadge intent="primary" dot>Primary</DsBadge>
            <DsBadge intent="success" dot>Ativo</DsBadge>
            <DsBadge intent="warning" dot>Atenção</DsBadge>
            <DsBadge intent="danger" dot>Falha</DsBadge>
            <DsBadge intent="info" dot>Info</DsBadge>
            <span className="ml-4 flex items-center gap-2 text-sm text-muted-foreground">
              Notificações <DsCount value={3} /> Muitas <DsCount value={99} intent="danger" />
            </span>
          </Row>
        </DsSection>

        {/* KPIs */}
        <DsSection title="KPI Stats — Home / BI">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <DsStat label="Faturado" value="R$ 35,1k" delta="+18% vs anterior" deltaIntent="success" icon={<TrendingUp className="h-4 w-4" />} />
            <DsStat label="CAC" value="R$ 1.259" delta="-6%" deltaIntent="success" hint="meta R$ 1.400" />
            <DsStat label="ROAS" value="9,3x" delta="+2,1x" deltaIntent="success" />
            <DsStat label="No-show" value="12%" delta="+3pp" deltaIntent="danger" hint="acima da meta" />
          </div>
        </DsSection>

        {/* Cards */}
        <DsSection title="Cards">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DsCard>
              <DsCardHeader title="Card padrão" subtitle="Nível 1 · superfície branca" action={<DsBadge intent="success" dot>ok</DsBadge>} />
              <p className="text-[13px] text-muted-foreground">
                Cards agrupam informação relacionada. Um card = um assunto. Ação no rodapé, alinhada à direita.
              </p>
              <DsCardFooter>
                <DsButton emphasis="ghost" size="sm">Cancelar</DsButton>
                <DsButton intent="primary" size="sm">Confirmar</DsButton>
              </DsCardFooter>
            </DsCard>
            <DsCard level={2} interactive onClick={() => toast.info("Card clicado")}>
              <DsCardHeader title="Card interativo (nível 2)" subtitle="Hover levanta a sombra" />
              <p className="text-[13px] text-muted-foreground">
                Superfície-2 para painéis aninhados. Clique dispara toast.
              </p>
            </DsCard>
          </div>
        </DsSection>

        {/* Alertas */}
        <DsSection title="Alertas — regra: todo alerta tem Resolver">
          <div className="space-y-3">
            <DsAlert
              intent="danger"
              title="3 leads sem atendimento há +15 min"
              description="Consultores online: 6. Coordenador precisa redistribuir agora."
              onResolve={() => toast.success("Redistribuído")}
              resolveLabel="Redistribuir"
            />
            <DsAlert
              intent="warning"
              title="Token do Meta Marketing expira em 4 dias"
              description="Sem ação, os anúncios param de sincronizar."
              onResolve={() => toast.info("Abrindo reconexão")}
              onDismiss={() => toast.message("Adiado")}
              resolveLabel="Reconectar"
            />
            <DsAlert
              intent="info"
              title="Nova versão do Solar OS disponível"
              description="Design System v2 ativado nesta tela."
              onResolve={() => toast.info("Ver changelog")}
              resolveLabel="Ver mudanças"
            />
            <DsAlert
              intent="success"
              title="Todas as integrações operacionais"
              onResolve={() => toast.success("Ver saúde")}
              resolveLabel="Ver saúde"
            />
          </div>
        </DsSection>

        {/* Empty states */}
        <DsSection title="Empty states — regra: sempre 1 CTA">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DsEmpty
              icon={<Inbox className="h-5 w-5" />}
              title="Nenhum lead na fila"
              description="Assim que um lead chegar, você verá aqui."
              actionLabel="Puxar da roleta"
              onAction={() => toast.info("Roleta acionada")}
            />
            <DsEmpty
              icon={<Users className="h-5 w-5" />}
              title="Sem consultores online"
              description="A distribuição automática está pausada."
              actionLabel="Notificar equipe"
              onAction={() => toast.info("Notificado")}
              actionIntent="warning"
            />
          </div>
        </DsSection>

        {/* Skeletons */}
        <DsSection title="Loading (skeleton, nunca spinner de página)">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DsCard>
              <div className="flex items-center gap-3">
                <DsSkeleton variant="avatar" />
                <div className="flex-1 space-y-2">
                  <DsSkeleton variant="line" className="w-2/3" />
                  <DsSkeleton variant="text" className="w-1/2" />
                </div>
              </div>
            </DsCard>
            <DsCard>
              <DsSkeletonList rows={4} />
            </DsCard>
          </div>
        </DsSection>

        {/* Tipografia */}
        <DsSection title="Tipografia — Sora (títulos) + Manrope (UI/corpo)">
          <DsCard>
            <h1 className="font-display text-[40px] font-semibold tracking-tight">Título nível 1</h1>
            <h2 className="font-display text-[32px] font-semibold tracking-tight">Título nível 2</h2>
            <h3 className="font-display text-[24px] font-semibold tracking-tight">Título nível 3</h3>
            <p className="mt-2 text-[16px]">Corpo padrão — Manrope 400/500. Legível e consistente em toda a plataforma.</p>
            <p className="mt-1 text-[14px] text-muted-foreground">Texto secundário — 14px muted.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Micro — 12px para metadados.</p>
          </DsCard>
        </DsSection>

        <div className="mt-8 text-center">
          <DsBadge intent="primary" dot>
            <Sun className="h-3 w-3" />
            Solar OS v2 · fundação pronta
          </DsBadge>
          <button
            className="mx-auto mt-3 block text-xs text-muted-foreground underline"
            onClick={() => toast.success("Notificação de teste", { icon: <Bell className="h-4 w-4" /> })}
          >
            testar toast
          </button>
        </div>
      </div>
    </BackendShellFrame>
  );
}
