import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun } from "lucide-react";

// Beta namespace on supabase-js — narrow typed wrapper.
type AuthzDetails = {
  client?: { name?: string; client_id?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[] | string;
};
type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
};
function oauthApi(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

function validateNext(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = validateNext(location.pathname + location.searchStr) ?? "/";
    if (!data.session) {
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId =
      new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
      return data;
    }
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md p-6 space-y-3">
        <h1 className="text-lg font-semibold">Não foi possível carregar a autorização</h1>
        <p className="text-sm text-muted-foreground">
          {(error as Error)?.message ?? "Erro desconhecido"}
        </p>
      </Card>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "Aplicativo externo";
  const scopes = Array.isArray(details?.scopes)
    ? details!.scopes
    : typeof details?.scopes === "string"
      ? details!.scopes.split(/\s+/).filter(Boolean)
      : [];

  async function decide(approve: boolean) {
    setBusy(true);
    setErr(null);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorization_id)
      : await oauthApi().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setErr(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setErr("O servidor de autorização não retornou uma URL de retorno.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md p-6 space-y-4 border-primary/10 shadow-elegant">
        <div className="inline-flex items-center gap-2 text-primary">
          <Sun className="h-5 w-5" />
          <span className="font-semibold">LZ7 Energia</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold">Conectar {clientName} à sua conta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clientName} poderá usar as ferramentas do CRM LZ7 <strong>como você</strong>. Todas
            as regras de acesso (RLS) do painel continuam valendo — o app só verá o que você
            enxerga.
          </p>
        </div>

        {scopes.length > 0 && (
          <div className="text-sm">
            <p className="text-xs uppercase text-muted-foreground mb-1">Permissões solicitadas</p>
            <ul className="list-disc pl-5 space-y-1">
              {scopes.map((s: string) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {err && (
          <p role="alert" className="text-sm text-destructive">
            {err}
          </p>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? "Processando..." : "Aprovar"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
