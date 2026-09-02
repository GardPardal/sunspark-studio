import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  CheckCheck,
  FileText,
  Headphones,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  Phone,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  User,
  UserCheck,
  UserMinus,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
      { title: "Central WhatsApp & IA LIZ | Solar OS" },
      {
        name: "description",
        content:
          "Central de atendimento WhatsApp ao vivo, transbordo para SDR e respostas automáticas da LIZ IA.",
      },
    ],
  }),
  component: WhatsAppInbox,
});

const STATUS_TABS = [
  { key: "todos", label: "Todas" },
  { key: "bot", label: "Com a IA (LIZ)" },
  { key: "humano", label: "Com SDR (Humano)" },
  { key: "encerrada", label: "Encerradas" },
] as const;

const QUICK_TEMPLATES = [
  {
    label: "👋 Apresentação Stephany",
    text: "Olá! Tudo bem? Aqui é a Stephany da LZ7 Energia Solar. Assumi seu atendimento para te passar os detalhes do seu projeto de economia!",
  },
  {
    label: "📄 Pedir Fatura de Luz",
    text: "Você teria fácil aí uma foto ou o PDF da sua última conta de luz? Nossos engenheiros conseguem analisar seu consumo histórico e dimensionar o projeto com 100% de exatidão!",
  },
  {
    label: "☀️ Estudo Pronto",
    text: "Ótima notícia! Nosso setor de engenharia acabou de finalizar o seu estudo solar personalizado com até 95% de economia. Posso te apresentar agora?",
  },
  {
    label: "⚡ Padrão 110V ou 220V",
    text: "Aí no seu imóvel a energia é 110V ou 220V? Isso nos ajuda a identificar se a sua rede é monofásica, bifásica ou trifásica.",
  },
  {
    label: "📅 Agendar Visita Técnica",
    text: "Que tal agendarmos uma visita técnica 100% gratuita no seu imóvel com um de nossos especialistas para avaliar o telhado e a rede elétrica?",
  },
];

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const num1 = digits.slice(4, 9);
    const num2 = digits.slice(9);
    return `(${ddd}) ${num1}-${num2}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const num1 = digits.slice(4, 8);
    const num2 = digits.slice(8);
    return `(${ddd}) ${num1}-${num2}`;
  }
  return phone;
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (name[0] || "C").toUpperCase();
}

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
    refetchInterval: 4_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  const claim = useMutation({
    mutationFn: (action: "assumir" | "devolver" | "encerrar") =>
      claimFn({ data: { conversationId: selected!, action } }),
    onSuccess: (_, action) => {
      toast.success(
        action === "assumir"
          ? "Atendimento assumido! A IA foi pausada para este contato."
          : action === "devolver"
            ? "Devolvido para a LIZ IA! O robô voltará a responder."
            : "Conversa encerrada.",
      );
      qc.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => sendFn({ data: { conversationId: selected!, text: draft.trim() } }),
    onSuccess: () => {
      setDraft("");
      toast.success("Mensagem enviada com sucesso no WhatsApp!");
      qc.invalidateQueries({ queryKey: ["wa-messages", selected] });
      qc.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
    onError: (e: Error) => toast.error(`Erro ao enviar: ${e.message}`),
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (draft.trim() && !send.isPending) {
        send.mutate();
      }
    }
  };

  const current = conversations.data?.find((c) => c.id === selected);

  return (
    <div className="mx-auto flex h-[calc(100vh-100px)] min-h-[680px] w-full max-w-7xl flex-col gap-3 p-2 sm:p-4">
      {/* Header compacto com estatísticas */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold tracking-tight">
                WhatsApp Hub · LZ7 Energia
              </h1>
              <p className="text-xs text-muted-foreground">
                Central oficial de atendimento em tempo real da SDR Stephany Martins e LIZ IA
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600 dark:text-emerald-400"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            WhatsApp Cloud API Conectada (+55 43 9976-0685)
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["wa-conversations"] });
              if (selected) qc.invalidateQueries({ queryKey: ["wa-messages", selected] });
              toast.info("Atualizando conversas...");
            }}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </header>

      {/* Grid estilo WhatsApp Web */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden rounded-xl border bg-card shadow-sm lg:grid-cols-[380px_1fr]">
        {/* LADO ESQUERDO: Lista de conversas */}
        <div className="flex flex-col border-r bg-muted/20">
          {/* Busca e Abas */}
          <div className="space-y-2 border-b bg-card/60 p-3 backdrop-blur-sm">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {STATUS_TABS.map((t) => (
                <Button
                  key={t.key}
                  size="sm"
                  variant={status === t.key ? "default" : "ghost"}
                  onClick={() => setStatus(t.key)}
                  className={cn(
                    "h-7 shrink-0 rounded-full px-2.5 text-xs font-medium",
                    status === t.key && "bg-emerald-600 text-white hover:bg-emerald-700",
                  )}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Lista de Contatos */}
          <ScrollArea className="flex-1">
            {conversations.isLoading ? (
              <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Carregando conversas...
              </div>
            ) : !conversations.data?.length ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <MessageSquare className="mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">Nenhuma conversa encontrada</p>
                <p className="mt-1 text-xs opacity-70">
                  As novas mensagens recebidas no WhatsApp aparecerão aqui instantaneamente.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {conversations.data.map((c) => {
                  const isSelected = selected === c.id;
                  const formatted = formatPhone(c.phone);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c.id)}
                      className={cn(
                        "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/70",
                        isSelected && "bg-muted shadow-inner",
                      )}
                    >
                      <Avatar className="h-11 w-11 border border-border/60">
                        <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-800 text-xs font-bold text-white">
                          {getInitials(c.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-heading text-sm font-semibold text-foreground">
                            {c.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {c.lastMessageAt
                              ? new Date(c.lastMessageAt).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>

                        <p className="truncate text-xs font-mono text-muted-foreground">
                          {formatted}
                        </p>

                        <div className="mt-1 flex items-center justify-between gap-1">
                          <p className="truncate text-xs text-muted-foreground/90">
                            {c.summary || "Nova conversa recebida"}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 px-1.5 py-0 text-[10px] font-medium",
                              c.status === "humano"
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : c.status === "bot"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "border-muted-foreground/30 text-muted-foreground",
                            )}
                          >
                            {c.status === "humano"
                              ? "👤 SDR"
                              : c.status === "bot"
                                ? "🤖 LIZ"
                                : "Fim"}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* LADO DIREITO: Painel de Chat ao Vivo */}
        <div className="flex flex-col overflow-hidden bg-background">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Nenhuma conversa selecionada
              </h2>
              <p className="max-w-sm text-xs text-muted-foreground">
                Selecione um contato na lista à esquerda para ler o histórico, ouvir áudios, assumir
                o atendimento ou enviar respostas pelo WhatsApp.
              </p>
            </div>
          ) : (
            <>
              {/* Header do Chat */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/50 p-3 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border/60">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-800 text-xs font-bold text-white">
                      {current?.name ? getInitials(current.name) : "C"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-sm font-bold text-foreground">
                        {current?.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2 py-0 text-[10px] font-semibold",
                          current?.status === "humano"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {current?.status === "humano"
                          ? "👤 Atendimento Humano (Stephany)"
                          : "🤖 LIZ IA Ativa no Chat"}
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">
                      {current?.phone ? formatPhone(current.phone) : ""}
                    </p>
                  </div>
                </div>

                {/* Ações Rápidas de Transbordo */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {current?.status === "bot" ? (
                    <Button
                      size="sm"
                      onClick={() => claim.mutate("assumir")}
                      disabled={claim.isPending}
                      className="bg-amber-600 text-white hover:bg-amber-700"
                    >
                      <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Assumir Atendimento
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => claim.mutate("devolver")}
                      disabled={claim.isPending}
                      className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                    >
                      <Bot className="mr-1.5 h-3.5 w-3.5" /> Devolver para IA (LIZ)
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => claim.mutate("encerrar")}
                    disabled={claim.isPending}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    <UserMinus className="mr-1 h-3.5 w-3.5" /> Encerrar
                  </Button>
                </div>
              </div>

              {/* Mensagens do Chat */}
              <ScrollArea className="flex-1 bg-muted/10 p-4">
                <div className="space-y-3">
                  {messages.isLoading ? (
                    <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Carregando mensagens...
                    </div>
                  ) : !messages.data?.length ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      Nenhuma mensagem registrada nesta conversa ainda.
                    </div>
                  ) : (
                    messages.data.map((m) => {
                      const isInbound = m.direction === "inbound";
                      const media = m.wa_media as unknown as {
                        transcript: string | null;
                        mime_type: string | null;
                      } | null;

                      const isAudio =
                        m.msg_type === "audio" ||
                        m.msg_type === "voice" ||
                        m.body?.startsWith("[Áudio");
                      const isImage =
                        m.msg_type === "image" ||
                        m.msg_type === "document" ||
                        m.body?.startsWith("[Foto");

                      return (
                        <div
                          key={m.id}
                          className={cn("flex w-full", isInbound ? "justify-start" : "justify-end")}
                        >
                          <div
                            className={cn(
                              "relative max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[75%]",
                              isInbound
                                ? "rounded-tl-sm border bg-card text-foreground"
                                : "rounded-tr-sm bg-emerald-700 text-white dark:bg-emerald-800",
                            )}
                          >
                            {/* Identificação do Remetente */}
                            <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-semibold opacity-75">
                              <span>{isInbound ? current?.name || "Cliente" : "LZ7 Energia"}</span>
                              {m.ai_generated && (
                                <span className="flex items-center gap-0.5 text-emerald-200">
                                  <Sparkles className="h-3 w-3" /> LIZ IA
                                </span>
                              )}
                            </div>

                            {/* Conteúdo com suporte a Áudio e Fotos */}
                            {isAudio ? (
                              <div className="space-y-1.5 py-1">
                                <div className="flex items-center gap-2 rounded-lg bg-black/10 p-2 text-xs">
                                  <Headphones className="h-4 w-4 shrink-0 text-emerald-400" />
                                  <span className="font-medium">Mensagem de Áudio / Voz</span>
                                </div>
                                <p className="text-xs italic opacity-90">
                                  {m.body || media?.transcript || "Transcrição do áudio"}
                                </p>
                              </div>
                            ) : isImage ? (
                              <div className="space-y-1.5 py-1">
                                <div className="flex items-center gap-2 rounded-lg bg-black/10 p-2 text-xs">
                                  <FileText className="h-4 w-4 shrink-0 text-emerald-400" />
                                  <span className="font-medium">Documento / Fatura de Energia</span>
                                </div>
                                <p className="text-xs">{m.body}</p>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                            )}

                            {/* Horário e Status */}
                            <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] opacity-70">
                              <span>
                                {new Date(m.occurred_at).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {!isInbound && (
                                <CheckCheck className="h-3.5 w-3.5 text-emerald-200" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              {/* Respostas Rápidas (Canned Responses) */}
              <div className="border-t bg-card/40 px-3 py-2 backdrop-blur-sm">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Respostas Rápidas:
                  </span>
                  {QUICK_TEMPLATES.map((tmpl) => (
                    <Button
                      key={tmpl.label}
                      size="sm"
                      variant="outline"
                      onClick={() => setDraft(tmpl.text)}
                      className="h-6 shrink-0 rounded-full px-2 text-[11px] font-normal hover:border-emerald-500 hover:text-emerald-600"
                    >
                      {tmpl.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Editor de Envio de Mensagem */}
              <div className="flex items-end gap-2 border-t bg-card p-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua resposta para o cliente (Enter para enviar, Shift+Enter para nova linha)..."
                  rows={2}
                  className="min-h-[52px] resize-none text-sm"
                />
                <Button
                  onClick={() => send.mutate()}
                  disabled={!draft.trim() || send.isPending}
                  size="default"
                  className="h-[52px] px-5 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                >
                  {send.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="mr-1.5 h-4 w-4" /> Enviar
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
