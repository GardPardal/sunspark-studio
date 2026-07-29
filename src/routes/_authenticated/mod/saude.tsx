import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { listSystemHealth, type HealthRow } from "@/lib/solar-os.functions";
import {
  listIntegrations,
  verifyIntegration,
  saveIntegrationConfig,
  type IntegrationConfigRow,
  type IntegrationService,
} from "@/lib/integrations.functions";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsBadge } from "@/components/ds/badge";
import { DsSkeletonList } from "@/components/ds/skeleton";
import { DsButton } from "@/components/ds/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity, CheckCircle2, AlertTriangle, XCircle, HelpCircle,
  RefreshCw, Settings, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mod/saude")({
  head: () => ({
    meta: [
      { title: "Integrações & Saúde — Solar OS" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SaudePage,
});

const SERVICE_LABEL: Record<string, string> = {
  db: "Banco de Dados",
  auth: "Autenticação",
  email: "E-mail",
  whatsapp: "WhatsApp",
  meta: "Meta Ads",
  google: "Google Agenda",
  ai: "LIZ (IA)",
  webhook: "Webhooks",
  ploomes: "Ploomes",
};

const STATUS_STYLE: Record<string, { tone: string; Icon: typeof Activity; label: string }> = {
  ok:      { tone: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30", Icon: CheckCircle2,   label: "Operacional" },
  warn:    { tone: "text-amber-700 bg-amber-500/10 border-amber-500/30",       Icon: AlertTriangle,  label: "Atenção" },
  down:    { tone: "text-red-700 bg-red-500/10 border-red-500/30",             Icon: XCircle,        label: "Fora do ar" },
  unknown: { tone: "text-muted-foreground bg-muted border-border",             Icon: HelpCircle,     label: "Aguardando verificação" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

function SaudePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSystemHealth);
  const integrationsFn = useServerFn(listIntegrations);
  const verifyFn = useServerFn(verifyIntegration);

  const health = useQuery({
    queryKey: ["system_health"],
    queryFn: () => listFn() as unknown as Promise<HealthRow[]>,
    refetchInterval: 60_000,
  });

  const integrations = useQuery({
    queryKey: ["integrations_config"],
    queryFn: () => integrationsFn() as unknown as Promise<IntegrationConfigRow[]>,
  });

  const [verifyingAll, setVerifyingAll] = useState(false);
  const [verifyingOne, setVerifyingOne] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState<IntegrationConfigRow | null>(null);

  const healthByService = useMemo(() => {
    const m = new Map<string, HealthRow>();
    for (const r of health.data ?? []) m.set(r.service, r);
    return m;
  }, [health.data]);

  const rows = integrations.data ?? [];

  async function runVerify(service: IntegrationService) {
    setVerifyingOne(service);
    try {
      const r = (await verifyFn({ data: { service } })) as { status: string; message: string };
      const t: any = r.status === "ok" ? toast.success : r.status === "warn" ? toast.warning : toast.error;
      t(`${SERVICE_LABEL[service] ?? service}: ${r.message}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["system_health"] }),
        qc.invalidateQueries({ queryKey: ["integrations_config"] }),
      ]);
    } catch (e: any) {
      toast.error(`Falha ao verificar: ${e?.message ?? "erro"}`);
    } finally {
      setVerifyingOne(null);
    }
  }

  async function runVerifyAll() {
    setVerifyingAll(true);
    try {
      for (const r of rows) {
        if (!r.spec.canVerify) continue;
        try {
          await verifyFn({ data: { service: r.service } });
        } catch {}
      }
      toast.success("Verificação completa.");
      await qc.invalidateQueries({ queryKey: ["system_health"] });
    } finally {
      setVerifyingAll(false);
    }
  }

  const okCount = rows.filter((r) => (healthByService.get(r.service)?.status ?? "unknown") === "ok").length;
  const downCount = rows.filter((r) => healthByService.get(r.service)?.status === "down").length;

  return (
    <ModuleShell title="Integrações & Saúde" subtitle="Configure, teste e monitore sem depender de suporte externo" active="saude">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1 min-w-[280px]">
          <DsCard><div className="p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Serviços</p><p className="mt-0.5 font-display text-xl font-semibold">{rows.length}</p></div></DsCard>
          <DsCard><div className="p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">OK</p><p className="mt-0.5 font-display text-xl font-semibold text-emerald-700">{okCount}</p></div></DsCard>
          <DsCard><div className="p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fora do ar</p><p className={cn("mt-0.5 font-display text-xl font-semibold", downCount > 0 ? "text-red-700" : "text-muted-foreground")}>{downCount}</p></div></DsCard>
        </div>
        <DsButton onClick={runVerifyAll} disabled={verifyingAll || rows.length === 0}>
          {verifyingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Verificar tudo
        </DsButton>
      </div>

      <DsCard>
        <DsCardHeader title="Integrações" subtitle="Clique em Configurar para inserir credenciais ou em Verificar para testar agora" />
        <div className="divide-y divide-border/60">
          {integrations.isLoading && (
            <div className="p-4"><DsSkeletonList rows={5} /></div>
          )}
          {!integrations.isLoading && rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma integração disponível.</p>
          )}
          {rows.map((row) => {
            const health = healthByService.get(row.service);
            const status = health?.status ?? "unknown";
            const style = STATUS_STYLE[status] ?? STATUS_STYLE.unknown;
            const configuredCount = Object.values(row.values).filter((v) => v.set).length;
            const needsConfig = row.spec.fields.length > 0 && configuredCount === 0;
            return (
              <div key={row.service} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl border shrink-0", style.tone)}>
                  <style.Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{SERVICE_LABEL[row.service] ?? row.service}</p>
                    <DsBadge intent={status === "ok" ? "success" : status === "down" ? "danger" : status === "warn" ? "warning" : "neutral"}>
                      {style.label}
                    </DsBadge>
                    {needsConfig && <DsBadge intent="warning">Falta configurar</DsBadge>}
                    {row.spec.fields.length > 0 && configuredCount > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {configuredCount}/{row.spec.fields.length} campos preenchidos
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {health?.message ?? row.spec.description}
                  </p>
                </div>
                <div className="text-right text-[10px] uppercase tracking-wide text-muted-foreground min-w-[80px]">
                  {health?.latency_ms != null && <div>{health.latency_ms}ms</div>}
                  <div>{health ? timeAgo(health.last_checked_at) : "sem check"}</div>
                </div>
                <div className="flex items-center gap-2">
                  {row.spec.canConfigure && (
                    <DsButton emphasis="ghost" size="sm" onClick={() => setConfigOpen(row)}>
                      <Settings className="mr-1.5 h-4 w-4" /> Configurar
                    </DsButton>
                  )}
                  {row.spec.canVerify && (
                    <DsButton
                      emphasis="soft"
                      size="sm"
                      onClick={() => runVerify(row.service)}
                      disabled={verifyingOne === row.service}
                    >
                      {verifyingOne === row.service ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-4 w-4" />
                      )}
                      Verificar
                    </DsButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DsCard>

      <ConfigDialog
        row={configOpen}
        onClose={() => setConfigOpen(null)}
        onSaved={async (service) => {
          await qc.invalidateQueries({ queryKey: ["integrations_config"] });
          await runVerify(service);
        }}
      />
    </ModuleShell>
  );
}

function ConfigDialog({
  row,
  onClose,
  onSaved,
}: {
  row: IntegrationConfigRow | null;
  onClose: () => void;
  onSaved: (service: IntegrationService) => void;
}) {
  const saveFn = useServerFn(saveIntegrationConfig);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const spec = row?.spec;
  const open = !!row;

  async function submit() {
    if (!row) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v && v.trim()) payload[k] = v.trim();
      }
      if (Object.keys(payload).length === 0) {
        toast.info("Nada para salvar — preencha ao menos um campo.");
        setSaving(false);
        return;
      }
      await saveFn({ data: { service: row.service, values: payload } });
      toast.success("Credenciais salvas.");
      setValues({});
      onClose();
      onSaved(row.service);
    } catch (e: any) {
      toast.error(`Não foi possível salvar: ${e?.message ?? "erro"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar — {spec?.label}</DialogTitle>
        </DialogHeader>
        {spec && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{spec.description}</p>
            {spec.fields.map((f) => {
              const current = row!.values[f.key];
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label>
                    {f.label}
                    {current?.set && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-700">
                        já configurado ({current.source})
                      </span>
                    )}
                  </Label>
                  <Input
                    type={f.secret ? "password" : "text"}
                    placeholder={current?.masked ?? f.placeholder ?? ""}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    autoComplete="off"
                  />
                  {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground">
              Deixe em branco para manter o valor atual. Valores salvos são usados imediatamente e sobrepõem variáveis de ambiente.
            </p>
          </div>
        )}
        <DialogFooter>
          <DsButton emphasis="ghost" onClick={onClose} disabled={saving}>Cancelar</DsButton>
          <DsButton onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar e testar
          </DsButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
