import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bot, MessageSquare, RefreshCw, Send, UserCheck, UserMinus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  claimWaConversation,
  getMyOrg,
  getWaChannelHealth,
  listWaConversations,
  listWaMessages,
  sendWaManualMessage,
} from "@/lib/wa-inbox.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mod/whatsapp/")({
  head: () => ({
    meta: [
      { title: "Caixa de entrada WhatsApp | Solar OS" },
      {
        name: "description",
        content:
          "Acompanhe conversas de WhatsApp, assuma atendimentos e responda clientes direto do Solar OS.",
      },
      { property: "og:title", content: "Caixa de entrada WhatsApp | Solar OS" },
      {
        property: "og:description",
        content: "Conversas, transbordo humano e respostas da IA em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsAppInbox,
});

const STATUS_TABS = [
  { key: "todos", label: "Todas" },
  { key: "humano", label: "Com você" },
  { key: "bot", label: "Com a IA" },
  { key: "encerrada", label: "Encerradas" },
] as const;

function WhatsAppInbox() {
  const orgFn = useServerFn(getMyOrg);
  const listFn = useServerFn(listWaConversations);
  const msgFn = useServerFn(listWaMessages);
  const healthFn = useServerFn(getWaChannelHealth);
  const claimFn = useServerFn(claimWaConversation);
  const sendFn = useServerFn(sendWaManualMessage);
  const qc = useQueryClient();

  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["key"]>("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const org = useQuery({ queryKey: ["my-org"], queryFn: () => orgFn({}) });
  const orgId = org.data?.id;

  const conversations = useQuery({
    queryKey: ["wa-conversations", orgId, status, search],
    queryFn: () => listFn({ data: { orgId, status, search: search || undefined } }),
    refetchInterval: 5_000,
  });

  const health = useQuery({
    queryKey: ["wa-health", orgId],
    queryFn: () => healthFn({ data: { orgId } }),
    refetchInterval: 15_000,
  });

  const messages = useQuery({
    queryKey: ["wa-messages", selected],
    queryFn: () => msgFn({ data: { conversationId: selected! } }),
    enabled: !!selected,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  const claim = useMutation({
    mutationFn: (action: "assumir" | "devolver" | "encerrar") =>
      claimFn({ data: { conversationId: selected!, action } }),
    onSuccess: () => {
      toast.success("Conversa atualizada");
      qc.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => sendFn({ data: { conversationId: selected!, text: draft.trim() } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["wa-messages", selected] });
      qc.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = conversations.data?.find((c) => c.id === selected);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Conversas recebidas, transbordo humano e respostas da IA.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Aguardando humano", value: health.data?.waitingHuman ?? 0 },
          { label: "Fila pendente", value: health.data?.pending ?? 0 },
          { label: "Falhas de envio 24h", value: health.data?.failedSends24h ?? 0 },
          { label: "Eventos travados", value: health.data?.dead ?? 0 },
        ].map((m) => (
          <Card key={m.label} className="p-3">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="font-heading text-xl font-semibold">{m.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="flex flex-col overflow-hidden">
          <div className="space-y-2 border-b p-3">
            <Input
              placeholder="Buscar nome ou telefone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-1 overflow-x-auto">
              {STATUS_TABS.map((t) => (
                <Button
                  key={t.key}
                  size="sm"
                  variant={status === t.key ? "default" : "ghost"}
                  onClick={() => setStatus(t.key)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          <ScrollArea className="h-[420px]">
            {conversations.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
            ) : !conversations.data?.length ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa por aqui ainda.</p>
            ) : (
              conversations.data.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b p-3 text-left transition-colors hover:bg-muted/60",
                    selected === c.id && "bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{c.name}</span>
                    <Badge variant={c.status === "humano" ? "default" : "secondary"}>
                      {c.status === "humano" ? "Humano" : c.status === "bot" ? "IA" : "Fim"}
                    </Badge>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {c.summary ?? c.phone}
                  </span>
                </button>
              ))
            )}
          </ScrollArea>
        </Card>

        <Card className="flex min-h-[520px] flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm">Escolha uma conversa para ver o histórico.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                <div>
                  <p className="font-medium">{current?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {current?.phone} · consentimento: {current?.consent}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => claim.mutate("assumir")}>
                    <UserCheck className="mr-1 h-4 w-4" /> Assumir
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => claim.mutate("devolver")}>
                    <Bot className="mr-1 h-4 w-4" /> Devolver à IA
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => claim.mutate("encerrar")}>
                    <UserMinus className="mr-1 h-4 w-4" /> Encerrar
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-3">
                <div className="space-y-3">
                  {messages.data?.map((m) => {
                    const media = m.wa_media as unknown as {
                      transcript: string | null;
                      mime_type: string | null;
                    } | null;
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                          m.direction === "inbound"
                            ? "bg-muted"
                            : "ml-auto bg-primary text-primary-foreground",
                        )}
                      >
                        <p className="whitespace-pre-wrap">
                          {m.body ?? media?.transcript ?? `[${m.msg_type}]`}
                        </p>
                        <p className="mt-1 text-[10px] opacity-70">
                          {new Date(m.occurred_at).toLocaleString("pt-BR")}
                          {m.ai_generated ? " · IA" : ""}
                          {m.status === "failed" ? " · falhou" : ""}
                        </p>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <div className="flex items-end gap-2 border-t p-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escreva uma resposta…"
                  rows={2}
                  className="resize-none"
                />
                <Button
                  onClick={() => send.mutate()}
                  disabled={!draft.trim() || send.isPending}
                  size="icon"
                >
                  {send.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
