import { createFileRoute, redirect } from "@tanstack/react-router";

// Mantido como fallback: a tela agora vive na URL simples /vendas
export const Route = createFileRoute("/_authenticated/mod/vendas")({
  beforeLoad: () => {
    throw redirect({ to: "/vendas" });
  },
});
