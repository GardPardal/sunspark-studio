import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Settings,
  UserCheck,
  UserMinus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  claimWaConversation,
  getWaChannelHealth,
  listWaConversations,
  listWaMessages,
  sendWaManualMessage,
  sendWaMediaMessage,
  startNewWaConversation,
} from "@/lib/wa-inbox.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mod/whatsapp/")({
  head: () => ({
    meta: [
      { title: "Inbox WhatsApp | Solar OS LZ7" },
      {
        name: "description",
        content:
          "Central de atendimento WhatsApp da LZ7 Energia: conversas em tempo real, respostas e handoff humano.",
      },
      { property: "og:title", content: "Inbox WhatsApp | Solar OS LZ7" },
      {
        property: "og:description",
        content: "Atenda clientes no WhatsApp direto pelo Solar OS, em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsAppInbox,
});

type StatusFiltro = "todos" | "bot" | "humano" | "encerrada";

const FILTROS: { key: StatusFiltro; label: string }[] = [
  { key: "todos", label: "Todas" },
  { key: "humano", label: "Humano" },
  { key: "bot", label: "Liz" },
  { key: "encerrada", label: "Encerradas" },
];

function horaCurta(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function WhatsAppInbox() {
  const qc = useQueryClient();
  const listConversas = useServerFn(listWaConversations);
  const listMensagens = useServerFn(listWaMessages);
  const enviarTexto = useServerFn(sendWaManualMessage);
  const enviarMidia = useServerFn(sendWaMediaMessage);
  const alterarStatus = useServerFn(claimWaConversation);
  const novaConversa = useServerFn(startNewWaConversation);
  const saudeFn = useServerFn(getWaChannelHealth);

  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const [busca, setBusca] = useState("");
  const [ativa, setAtiva] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const [novoContato, setNovoContato] = useState({ nome: "", telefone: "", mensagem: "" });

  const fimRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const conversas = useQuery({
    queryKey: ["wa-conversas", filtro, busca],
    queryFn: () => listConversas({ data: { status: filtro, search: busca || undefined } }),
    refetchInterval: 30000,
  });

  const mensagens = useQuery({
    queryKey: ["wa-mensagens", ativa],
    queryFn: () => listMensagens({ data: { conversationId: ativa! } }),
    enabled: !!ativa,
  });

  const saude = useQuery({
    queryKey: ["wa-saude"],
    queryFn: () => saudeFn({ data: {} }),
    refetchInterval: 60000,
  });

  // Tempo real: novas mensagens e mudanças de conversa
  useEffect(() => {
    const canal = supabase
      .channel("wa-inbox-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-mensagens"] });
        qc.invalidateQueries({ queryKey: ["wa-conversas"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["wa-conversas"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens.data?.length, ativa]);

  const conversaAtiva = useMemo(
    () => conversas.data?.find((c) => c.id === ativa) ?? null,
    [conversas.data, ativa],
  );

  const envio = useMutation({
    mutationFn: async (msg: string) => enviarTexto({ data: { conversationId: ativa!, text: msg } }),
    onSuccess: () => {
      setTexto("");
      qc.invalidateQueries({ queryKey: ["wa-mensagens", ativa] });
      qc.invalidateQueries({ queryKey: ["wa-conversas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const envioMidia = useMutation({
    mutationFn: async (file: File) => {
      const base64Data = await fileToBase64(file);
      const tipo = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : "document";
      return enviarMidia({
        data: {
          conversationId: ativa!,
          type: tipo as "image" | "video" | "audio" | "document",
          base64Data,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-mensagens", ativa] });
      toast.success("Arquivo enviado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = useMutation({
    mutationFn: async (action: "assumir" | "devolver" | "encerrar") =>
      alterarStatus({ data: { conversationId: ativa!, action } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-conversas"] });
      toast.success("Conversa atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: async () =>
      novaConversa({
        data: {
          name: novoContato.nome || undefined,
          phone: novoContato.telefone,
          initialMessage: novoContato.mensagem,
        },
      }),
    onSuccess: (res) => {
      setNovaAberta(false);
      setNovoContato({ nome: "", telefone: "", mensagem: "" });
      qc.invalidateQueries({ queryKey: ["wa-conversas"] });
      if (res?.conversationId) setAtiva(res.conversationId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h1 className="font-heading text-lg font-semibold tracking-tight">WhatsApp</h1>
          <p className="truncate text-xs text-muted-foreground">
            {saude.data
              ? `${saude.data.waitingHuman} em atendimento humano · ${saude.data.failedSends24h} falhas 24h`
              : "Carregando indicadores…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["wa-conversas"] });
              qc.invalidateQueries({ queryKey: ["wa-mensagens"] });
            }}
            aria-label="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Configurações">
            <Link to="/mod/whatsapp/config">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="sm" onClick={() => setNovaAberta(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Nova
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Lista */}
        <aside
          className={cn(
            "flex w-full min-w-0 flex-col border-r border-border md:w-80 lg:w-96",
            ativa && "hidden md:flex",
          )}
        >
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome ou telefone"
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {FILTROS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFiltro(f.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filtro === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversas.isLoading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {conversas.data?.length === 0 && !conversas.isLoading && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma conversa neste filtro.
              </p>
            )}
            {conversas.data?.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setAtiva(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors hover:bg-accent/60",
                  ativa === c.id && "bg-accent",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {iniciais(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {horaCurta(c.lastMessageAt)}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {c.summary || c.phone}
                    </span>
                    {c.unread > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Conversa */}
        <section className={cn("flex min-w-0 flex-1 flex-col", !ativa && "hidden md:flex")}>
          {!ativa ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Bot className="h-10 w-10 opacity-40" />
              <p className="text-sm">Selecione uma conversa para começar.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border px-3 py-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setAtiva(null)}
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {conversaAtiva?.name ?? "Conversa"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{conversaAtiva?.phone}</p>
                </div>
                <Badge variant={conversaAtiva?.status === "humano" ? "default" : "secondary"}>
                  {conversaAtiva?.status ?? "—"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => status.mutate("assumir")}
                  aria-label="Assumir"
                >
                  <UserCheck className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => status.mutate("devolver")}
                  aria-label="Devolver para a Liz"
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => status.mutate("encerrar")}
                  aria-label="Encerrar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 px-3 py-4">
                {mensagens.isLoading && (
                  <div className="flex justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
                {!mensagens.isLoading && mensagens.data?.length === 0 && (
                  <p className="mx-auto max-w-md rounded-lg bg-background px-4 py-3 text-center text-xs text-muted-foreground">
                    Sem histórico anterior disponível. O WhatsApp não devolve conversas antigas —
                    novas mensagens aparecem aqui automaticamente.
                  </p>
                )}
                {mensagens.data?.map((m: any) => {
                  const meu = m.direction === "outbound";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex w-full", meu ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          meu
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm bg-background",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={cn(
                            "mt-1 flex items-center justify-end gap-1 text-[10px]",
                            meu ? "text-primary-foreground/70" : "text-muted-foreground",
                          )}
                        >
                          {horaCurta(m.occurred_at)}
                          {meu && m.status === "sending" && <Clock className="h-3 w-3" />}
                          {meu && m.status === "sent" && <Check className="h-3 w-3" />}
                          {meu && (m.status === "delivered" || m.status === "read") && (
                            <CheckCheck className="h-3 w-3" />
                          )}
                          {meu && m.status === "failed" && (
                            <AlertCircle className="h-3 w-3 text-destructive" />
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={fimRef} />
              </div>

              <form
                className="flex items-end gap-2 border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!texto.trim() || envio.isPending) return;
                  envio.mutate(texto.trim());
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) envioMidia.mutate(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileRef.current?.click()}
                  disabled={envioMidia.isPending}
                  aria-label="Anexar arquivo"
                >
                  {envioMidia.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (texto.trim() && !envio.isPending) envio.mutate(texto.trim());
                    }
                  }}
                  placeholder="Escreva uma mensagem"
                  rows={1}
                  className="max-h-32 min-h-10 resize-none"
                />
                <Button type="submit" size="icon" disabled={!texto.trim() || envio.isPending}>
                  {envio.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </>
          )}
        </section>
      </div>

      <Dialog open={novaAberta} onOpenChange={setNovaAberta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
            <DialogDescription>
              Envia a primeira mensagem pelo número conectado da empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nome do contato (opcional)"
              value={novoContato.nome}
              onChange={(e) => setNovoContato((s) => ({ ...s, nome: e.target.value }))}
            />
            <Input
              placeholder="Telefone com DDD (ex: 43999999999)"
              value={novoContato.telefone}
              onChange={(e) => setNovoContato((s) => ({ ...s, telefone: e.target.value }))}
            />
            <Textarea
              placeholder="Mensagem inicial"
              rows={3}
              value={novoContato.mensagem}
              onChange={(e) => setNovoContato((s) => ({ ...s, mensagem: e.target.value }))}
            />
            <Button
              className="w-full"
              disabled={
                criar.isPending ||
                novoContato.telefone.replace(/\D/g, "").length < 10 ||
                !novoContato.mensagem.trim()
              }
              onClick={() => criar.mutate()}
            >
              {criar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar mensagem
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
