import { createFileRoute, Link } from "@tanstack/react-router";
import { useSearch } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getApprovalByToken, decideByToken } from "@/lib/account-approval.functions";
import { z } from "zod";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/aprovar-usuario")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Aprovar acesso — LZ7 Energia" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ApprovePage,
});

const UNIT_LABEL: Record<string, string> = {
  londrina: "Londrina",
  ponta_grossa: "Ponta Grossa",
  wenceslau_braz: "Wenceslau Braz",
};

function ApprovePage() {
  const { token } = useSearch({ from: "/aprovar-usuario" });
  const getFn = useServerFn(getApprovalByToken);
  const decideFn = useServerFn(decideByToken);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["approval", token],
    queryFn: () => getFn({ data: { token: token ?? "" } }),
    enabled: !!token,
  });

  const decideM = useMutation({
    mutationFn: (decision: "approved" | "rejected") => decideFn({ data: { token: token ?? "", decision } }),
    onSuccess: (_, decision) => {
      toast.success(decision === "approved" ? "Usuário aprovado!" : "Usuário rejeitado.");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md p-8 shadow-elegant border-primary/10">
        <div className="mb-6 inline-flex items-center gap-2 text-primary">
          <Sun className="h-5 w-5" /> <span className="font-semibold">LZ7 Energia</span>
        </div>

        {!token && (
          <div className="text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <h1 className="text-xl font-semibold mb-2">Link inválido</h1>
            <p className="text-sm text-muted-foreground">Token de aprovação ausente.</p>
          </div>
        )}

        {token && isLoading && <div className="text-center text-muted-foreground py-8">Carregando pedido...</div>}

        {token && data && !data.ok && (
          <div className="text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h1 className="text-xl font-semibold mb-2">
              {data.reason === "expired" ? "Link expirado" : "Pedido não encontrado"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {data.reason === "expired"
                ? "Esse link já ultrapassou 48h. Peça um novo cadastro."
                : "O token informado é inválido ou já foi utilizado."}
            </p>
          </div>
        )}

        {token && data && data.ok && (
          <>
            {data.approval.status !== "pending" ? (
              <div className="text-center">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" />
                <h1 className="text-xl font-semibold mb-2">Pedido já decidido</h1>
                <p className="text-sm text-muted-foreground">
                  Status: <strong className="text-foreground">{data.approval.status === "approved" ? "Aprovado" : "Rejeitado"}</strong>
                </p>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-semibold mb-1">Novo pedido de acesso</h1>
                <p className="text-sm text-muted-foreground mb-6">Confira os dados e decida:</p>

                <div className="rounded-lg border p-4 space-y-2 bg-secondary/30">
                  <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Nome</span><div className="font-medium">{data.approval.full_name || "—"}</div></div>
                  <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Email</span><div className="font-medium">{data.approval.email}</div></div>
                  <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Unidade solicitada</span><div className="font-medium">{data.approval.requested_unit ? UNIT_LABEL[data.approval.requested_unit] : "—"}</div></div>
                  <div><span className="text-xs uppercase tracking-wide text-muted-foreground">Solicitado em</span><div className="text-sm">{new Date(data.approval.created_at).toLocaleString("pt-BR")}</div></div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Button variant="outline" disabled={decideM.isPending} onClick={() => decideM.mutate("rejected")}>
                    <XCircle className="h-4 w-4 mr-2" /> Rejeitar
                  </Button>
                  <Button disabled={decideM.isPending} onClick={() => decideM.mutate("approved")}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        <div className="mt-6 text-center">
          <Link to="/auth" className="text-xs text-muted-foreground hover:text-primary">Voltar ao login</Link>
        </div>
      </Card>
    </div>
  );
}
