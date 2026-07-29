import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listPloomesWebhooks,
  ensurePloomesWebhooks,
  deletePloomesWebhook,
  getPloomesIntegrationStats,
  retryConversionEvent,
} from "@/lib/ploomes-webhooks.functions";
import { DsCard } from "@/components/ds/DsCard";
import { DsButton } from "@/components/ds/DsButton";
import { DsStat } from "@/components/ds/DsStat";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mod/ploomes-integracao")({
  head: () => ({
    meta: [
      { title: "Integração Ploomes ↔ Meta · Solar OS" },
      { name: "description", content: "Painel de integração Ploomes com Meta Conversions API." },
    ],
  }),
  component: PloomesIntegracaoPage,
});

function PloomesIntegracaoPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPloomesWebhooks);
  const statsFn = useServerFn(getPloomesIntegrationStats);
  const ensureFn = useServerFn(ensurePloomesWebhooks);
  const deleteFn = useServerFn(deletePloomesWebhook);
  const retryFn = useServerFn(retryConversionEvent);

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/ploomes/webhook`
      : "/api/public/ploomes/webhook";

  const [validationKey, setValidationKey] = useState("");

  const hooks = useQuery({
    queryKey: ["ploomes", "webhooks"],
    queryFn: () => listFn({ data: {} as any }),
  });
  const stats = useQuery({
    queryKey: ["ploomes", "stats"],
    queryFn: () => statsFn({ data: {} as any }),
    refetchInterval: 15000,
  });

  const ensure = useMutation({
    mutationFn: (v: { callbackUrl: string; validationKey?: string }) =>
      ensureFn({ data: v }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success(`Webhooks OK — criados: ${r.created?.length ?? 0}`);
      else toast.error(r?.message ?? `Falha: ${(r?.errors ?? []).join(" | ")}`);
      qc.invalidateQueries({ queryKey: ["ploomes"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: number | string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Webhook removido");
      qc.invalidateQueries({ queryKey: ["ploomes", "webhooks"] });
    },
  });

  const retry = useMutation({
    mutationFn: (eventId: string) => retryFn({ data: { eventId } }),
    onSuccess: (r: any) => {
      if (r?.ok) toast.success("Reenviado");
      else toast.error(r?.message ?? "Falha ao reenviar");
      qc.invalidateQueries({ queryKey: ["ploomes", "stats"] });
    },
  });

  const s: any = stats.data ?? {};
  const webhooks: any[] = (hooks.data as any)?.webhooks ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Integração Ploomes ↔ Meta</h1>
        <p className="text-sm text-muted-foreground">
          Webhooks oficiais do Ploomes disparam eventos Lead/Purchase na Meta Conversions API em tempo real.
        </p>
      </header>

      {/* Registro do webhook */}
      <DsCard>
        <div className="space-y-4 p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">1 · Registrar webhook no Ploomes</h2>
            <p className="text-sm text-muted-foreground">
              Registra automaticamente (via API oficial) os webhooks de Deal e Contact apontando para o endpoint abaixo.
              Se já existir, ignora.
            </p>
          </div>

          <label className="block text-xs font-medium text-muted-foreground">CallbackUrl</label>
          <code className="block truncate rounded border bg-muted px-3 py-2 text-xs">{callbackUrl}</code>

          <label className="block text-xs font-medium text-muted-foreground">
            ValidationKey (opcional — gera automaticamente se em branco)
          </label>
          <input
            className="w-full rounded border bg-background px-3 py-2 text-sm"
            placeholder="deixe em branco para gerar uma chave segura"
            value={validationKey}
            onChange={(e) => setValidationKey(e.target.value)}
          />

          <DsButton
            onClick={() =>
              ensure.mutate({ callbackUrl, validationKey: validationKey || undefined })
            }
            disabled={ensure.isPending}
          >
            {ensure.isPending ? "Registrando..." : "Registrar / Verificar webhooks"}
          </DsButton>
        </div>
      </DsCard>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DsStat
          label="Eventos p/ Meta hoje"
          value={String(s.sentToday ?? 0)}
          hint={
            s.lastMetaEvent
              ? `último: ${s.lastMetaEvent.event_name} · ${s.lastMetaEvent.platform}`
              : "nenhum ainda"
          }
        />
        <DsStat
          label="Último webhook recebido"
          value={
            s.lastWebhook?.created_at
              ? new Date(s.lastWebhook.created_at).toLocaleString("pt-BR")
              : "—"
          }
          hint={s.lastWebhook?.status ?? "aguardando"}
        />
        <DsStat
          label="Erros recentes"
          value={String((s.recentErrors ?? []).length)}
          hint="últimas 24h"
        />
      </div>

      {/* Webhooks registrados */}
      <DsCard>
        <div className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Webhooks ativos no Ploomes</h2>
          {hooks.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum webhook registrado.</p>
          ) : (
            <ul className="divide-y">
              {webhooks.map((w) => (
                <li key={w.Id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      Entity {w.EntityId} · Action {w.ActionId}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {w.CallBackUrl ?? w.CallbackUrl}
                    </div>
                  </div>
                  <DsButton size="sm" variant="ghost" onClick={() => del.mutate(w.Id)}>
                    Remover
                  </DsButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DsCard>

      {/* Eventos com falha */}
      <DsCard>
        <div className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Eventos com falha (reenviar)</h2>
          {(s.failedEvents ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem falhas 🎉</p>
          ) : (
            <ul className="divide-y">
              {(s.failedEvents ?? []).map((e: any) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {e.event_name} · {e.platform}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR")} · status: {e.status}
                    </div>
                  </div>
                  <DsButton size="sm" onClick={() => retry.mutate(e.id)}>
                    Reenviar
                  </DsButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DsCard>

      {/* Erros de integração */}
      {(s.recentErrors ?? []).length > 0 && (
        <DsCard>
          <div className="space-y-2 p-5">
            <h2 className="text-lg font-semibold">Log de erros</h2>
            <ul className="space-y-1 text-xs">
              {s.recentErrors.map((e: any, i: number) => (
                <li key={i} className="border-l-2 border-destructive/60 pl-2">
                  <span className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR")} · {e.provider}
                  </span>
                  <div className="truncate">{e.message}</div>
                </li>
              ))}
            </ul>
          </div>
        </DsCard>
      )}
    </div>
  );
}
