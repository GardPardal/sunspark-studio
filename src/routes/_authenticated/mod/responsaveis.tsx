import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ModuleShell } from "@/modules/shared/module-shell";
import { DsCard, DsCardHeader } from "@/components/ds/card";
import { DsButton } from "@/components/ds/button";
import { DsBadge } from "@/components/ds/badge";
import { DsSkeletonList } from "@/components/ds/skeleton";
import { Input } from "@/components/ui/input";
import { RefreshCw, Link2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  listPloomesUsers,
  syncPloomesUsers,
  updatePloomesUser,
} from "@/lib/ploomes-users.functions";

export const Route = createFileRoute("/_authenticated/mod/responsaveis")({
  head: () => ({
    meta: [
      { title: "Responsáveis Ploomes — Solar OS" },
      {
        name: "description",
        content:
          "Sincronize e gerencie os responsáveis do Ploomes junto com os logins e vendedores do sistema.",
      },
      { property: "og:title", content: "Responsáveis Ploomes — Solar OS" },
      {
        property: "og:description",
        content: "Gestão unificada de responsáveis Ploomes, logins e vendedores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResponsaveisPage,
});

const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

const UNITS = [
  { v: "londrina", l: "Londrina" },
  { v: "ponta_grossa", l: "Ponta Grossa" },
  { v: "wenceslau_braz", l: "Wenceslau Braz" },
] as const;

function ResponsaveisPage() {
  const qc = useQueryClient();
  const load = useServerFn(listPloomesUsers);
  const sync = useServerFn(syncPloomesUsers);
  const update = useServerFn(updatePloomesUser);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ploomes-users"],
    queryFn: () => load(),
  });

  const syncMut = useMutation({
    mutationFn: () => sync({ data: { createSellers: true } }),
    onSuccess: (r: any) => {
      toast.success(
        `Sincronizado: ${r.synced} responsáveis · ${r.created} novos · ${r.linked} vinculados a logins · ${r.sellersCreated} vendedores criados`,
      );
      if (r.apiError) toast.warning(`Ploomes API: ${r.apiError} (usei o formulário público)`);
      qc.invalidateQueries({ queryKey: ["ploomes-users"] });
      qc.invalidateQueries({ queryKey: ["sellers"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao sincronizar"),
  });

  const updMut = useMutation({
    mutationFn: (v: any) => update({ data: v }),
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["ploomes-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const users = data?.users ?? [];
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(t) || (u.email ?? "").toLowerCase().includes(t),
    );
  }, [users, q]);

  const semLogin = users.filter((u) => !u.profile_id).length;

  return (
    <ModuleShell
      title="Responsáveis Ploomes"
      subtitle="Uma lista só: Ploomes ↔ logins do sistema ↔ vendedores do ranking"
      active="admin"
    >
      <DsCard>
        <DsCardHeader
          title="Sincronização"
          subtitle="Puxa os responsáveis cadastrados no Ploomes, vincula automaticamente aos logins e cria o vendedor no ranking."
          action={
            <DsButton onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
              <RefreshCw className={`h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} />
              {syncMut.isPending ? "Sincronizando…" : "Sincronizar agora"}
            </DsButton>
          }
        />
        <div className="flex flex-wrap gap-2 px-4 pb-4 text-xs text-muted-foreground">
          <DsBadge intent="neutral">{users.length} responsáveis</DsBadge>
          <DsBadge intent={semLogin > 0 ? "warning" : "success"}>
            {semLogin} sem login vinculado
          </DsBadge>
        </div>
      </DsCard>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar responsável por nome ou e-mail"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <DsSkeletonList />
      ) : filtered.length === 0 ? (
        <DsCard>
          <div className="p-6 text-sm text-muted-foreground">
            Nenhum responsável ainda. Clique em <strong>Sincronizar agora</strong> para trazer do
            Ploomes.
          </div>
        </DsCard>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u) => (
            <DsCard key={u.ploomes_id}>
              <div className="p-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{u.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.email ?? "sem e-mail"} · Ploomes #{u.ploomes_id}
                  </div>
                  <div className="mt-1 flex gap-1">
                    <DsBadge intent={u.active ? "success" : "neutral"}>
                      {u.active ? "Ativo" : "Inativo"}
                    </DsBadge>
                    {u.profile_id ? (
                      <DsBadge intent="info">
                        <Link2 className="h-3 w-3" /> login
                      </DsBadge>
                    ) : (
                      <DsBadge intent="warning">sem login</DsBadge>
                    )}
                  </div>
                </div>

                <label className="text-xs text-muted-foreground">
                  Login do sistema
                  <select
                    className={selectCls}
                    value={u.profile_id ?? ""}
                    onChange={(e) =>
                      updMut.mutate({
                        ploomes_id: u.ploomes_id,
                        profile_id: e.target.value || null,
                      })
                    }
                  >
                    <option value="">— não vinculado —</option>
                    {(data?.profiles ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-muted-foreground">
                  Vendedor (ranking)
                  <select
                    className={selectCls}
                    value={u.seller_id ?? ""}
                    onChange={(e) =>
                      updMut.mutate({ ploomes_id: u.ploomes_id, seller_id: e.target.value || null })
                    }
                  >
                    <option value="">— não vinculado —</option>
                    {(data?.sellers ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">
                    Unidade
                    <select
                      className={selectCls}
                      value={u.unit ?? ""}
                      onChange={(e) =>
                        updMut.mutate({
                          ploomes_id: u.ploomes_id,
                          unit: (e.target.value || null) as any,
                        })
                      }
                    >
                      <option value="">—</option>
                      {UNITS.map((x) => (
                        <option key={x.v} value={x.v}>
                          {x.l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <DsButton
                    emphasis="ghost"
                    onClick={() => updMut.mutate({ ploomes_id: u.ploomes_id, active: !u.active })}
                  >
                    {u.active ? "Desativar" : "Ativar"}
                  </DsButton>
                </div>
              </div>
            </DsCard>
          ))}
        </div>
      )}
    </ModuleShell>
  );
}
