import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Phone, MessageCircle, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { DsCard, DsBadge, DsEmpty, DsPageHeader, DsSkeletonList } from "@/components/ds";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads WhatsApp · LZ7 Energia" },
      {
        name: "description",
        content: "Lista dos leads captados pela página /wpp, com busca rápida por nome, telefone ou origem.",
      },
      { property: "og:title", content: "Leads WhatsApp · LZ7 Energia" },
      { property: "og:description", content: "Leads captados pela landing de WhatsApp da LZ7 Energia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LeadsWppPage,
});

type LeadRow = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  origem: string | null;
  stage: string;
  created_at: string;
};

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function LeadsWppPage() {
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["leads-wpp"],
    queryFn: async (): Promise<LeadRow[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select("id,nome,telefone,email,cidade,estado,origem,stage,created_at")
        .or("origem.ilike.wpp%,origem.ilike.whatsapp%,page_url.ilike.%/wpp%")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = data ?? [];
    if (!term) return rows;
    const digits = onlyDigits(term);
    return rows.filter((l) => {
      const hay = [l.nome, l.telefone, l.email, l.cidade, l.estado, l.origem]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term) || (digits.length >= 3 && onlyDigits(l.telefone).includes(digits));
    });
  }, [data, q]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 space-y-4">
      <DsPageHeader
        title="Leads WhatsApp"
        subtitle="Captados pela página /wpp — não são enviados ao Ploomes."
      />


      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, telefone, cidade…"
          className="h-12 pl-9 text-base"
          inputMode="search"
          autoComplete="off"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {isLoading ? "Carregando…" : `${filtered.length} lead(s)`}
      </p>

      {error && (
        <p className="text-sm text-destructive">Erro ao carregar leads: {(error as Error).message}</p>
      )}

      {isLoading ? (
        <DsSkeletonList />
      ) : filtered.length === 0 ? (
        <DsEmpty
          icon={<MessageCircle className="h-5 w-5" />}
          title="Nenhum lead encontrado"
          description={q ? "Tente outro termo de busca." : "Assim que alguém preencher a página /wpp, aparece aqui."}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((lead) => (
            <li key={lead.id}>
              <DsCard className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{lead.nome}</p>
                    <p className="text-sm text-muted-foreground">{lead.telefone}</p>
                    {(lead.cidade || lead.estado) && (
                      <p className="text-xs text-muted-foreground">
                        {[lead.cidade, lead.estado].filter(Boolean).join("/")}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {fmtDate(lead.created_at)} · {lead.origem ?? "wpp"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <DsBadge>{lead.stage}</DsBadge>
                    <div className="flex gap-2">
                      <a
                        href={`tel:${onlyDigits(lead.telefone)}`}
                        aria-label={`Ligar para ${lead.nome}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-foreground"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                      <a
                        href={`https://wa.me/55${onlyDigits(lead.telefone).replace(/^55/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`WhatsApp de ${lead.nome}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-foreground"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </DsCard>
            </li>
          ))}
        </ul>
      )}

      {isLoading && <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
