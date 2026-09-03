import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Brain,
  Check,
  ChevronUp,
  Download,
  FileText,
  Image as ImageIcon,
  MapPin,
  Wrench,
  CheckCheck,
  Clock,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  RefreshCw,
  RotateCcw,
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
  markWaConversationRead,
  reiniciarLizChat,
  repairWaMessages,
  sendWaMediaMessage,
  startNewWaConversation,
  syncWaIdentities,
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

type StatusFiltro = "todos" | "nao_lidas" | "bot" | "humano" | "encerrada";

const FILTROS: { key: StatusFiltro; label: string }[] = [
  { key: "todos", label: "Todas" },
  { key: "nao_lidas", label: "Não lidas" },
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
  const marcarLida = useServerFn(markWaConversationRead);
  const sincronizar = useServerFn(syncWaIdentities);
  const reparar = useServerFn(repairWaMessages);

  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const [busca, setBusca] = useState("");
  const [ativa, setAtiva] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const [novoContato, setNovoContato] = useState({ nome: "", telefone: "", mensagem: "" });
  const [antesDe, setAntesDe] = useState<string | null>(null);
  const [anteriores, setAnteriores] = useState<any[]>([]);
  const [manutencao, setManutencao] = useState(false);

  const fimRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const coladoNoFim = useRef(true);

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

  // Ao trocar de conversa: limpa páginas antigas e zera não lidas.
  useEffect(() => {
    setAnteriores([]);
    setAntesDe(null);
    coladoNoFim.current = true;
    if (!ativa) return;
    void marcarLida({ data: { conversationId: ativa } }).then(() => {
      qc.invalidateQueries({ queryKey: ["wa-conversas"] });
    });
  }, [ativa, marcarLida, qc]);

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

  const listaMensagens = useMemo(() => {
    const atuais = mensagens.data?.messages ?? [];
    if (mensagens.data && mensagens.data.conversationId !== ativa) return [];
    return [...anteriores, ...atuais];
  }, [mensagens.data, anteriores, ativa]);

  // Só rola para o fim quando o atendente já está no fim da conversa.
  useEffect(() => {
    if (coladoNoFim.current) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [listaMensagens.length, ativa]);

  const carregarAnteriores = async () => {
    const primeira = listaMensagens[0];
    if (!ativa || !primeira) return;
    const res = await listMensagens({
      data: { conversationId: ativa, beforeOccurredAt: primeira.occurred_at },
    });
    setAnteriores((prev) => [...res.messages, ...prev]);
    setAntesDe(res.hasMore ? res.messages[0]?.occurred_at ?? null : null);
    if (!res.messages.length) setAntesDe(null);
  };

  const temMaisAntigas = anteriores.length > 0 ? !!antesDe : !!mensagens.data?.hasMore;

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

  const reiniciarFn = useServerFn(reiniciarLizChat);
  const reiniciar = useMutation({
    mutationFn: async () => reiniciarFn({ data: { conversationId: ativa! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-conversas"] });
      qc.invalidateQueries({ queryKey: ["wa-mensagens", ativa] });
      toast.success("🧠 LIZ reiniciada! Mensagem de continuidade enviada no WhatsApp.");
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sincronizar contatos e reparar histórico"
            disabled={manutencao}
            onClick={async () => {
              setManutencao(true);
              try {
                const [ident, rep] = await Promise.all([
                  sincronizar({ data: { refreshPhotos: true } }),
                  reparar({ data: { limit: 500 } }),
                ]);
                toast.success(
                  `Contatos: ${ident.nomesCorrigidos} nomes, ${ident.telefonesResolvidos} telefones, ${ident.fotos} fotos. Mensagens recuperadas: ${rep.recuperados} (pendentes: ${rep.pendentes}).`,
                );
                qc.invalidateQueries({ queryKey: ["wa-conversas"] });
                qc.invalidateQueries({ queryKey: ["wa-mensagens"] });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Falha na sincronização");
              } finally {
                setManutencao(false);
              }
            }}
          >
            {manutencao ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wrench className="h-4 w-4" />
            )}
          </Button>
          <Button asChild variant="outline" size="sm" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-medium text-xs gap-1.5 shadow-xs">
            <Link to="/liztreinamento">
              <Brain className="h-3.5 w-3.5 text-amber-500" />
              Treine a LIZ
            </Link>
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
                {c.avatarUrl ? (
                  <img
                    src={c.avatarUrl}
                    alt={`Foto de ${c.name}`}
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {iniciais(c.name)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {horaCurta(c.lastMessageAt)}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {c.summary || "Sem mensagens registradas"}
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

                {/* Botão de Ativação da LIZ IA para este Chat */}
                <Button
                  variant={conversaAtiva?.status === "bot" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (conversaAtiva?.status === "bot") {
                      status.mutate("assumir");
                      toast.info("Atendimento Humano assumido. LIZ IA pausada para este chat.");
                    } else {
                      status.mutate("devolver");
                      toast.success("🧠 LIZ IA ativada neste chat! Ela responderá automaticamente.");
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 font-medium transition-all",
                    conversaAtiva?.status === "bot"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      : "border-primary/40 text-primary hover:bg-primary/10",
                  )}
                  title={
                    conversaAtiva?.status === "bot"
                      ? "LIZ IA está ativa neste chat. Clique para Stephany assumir."
                      : "Clique para ativar a LIZ IA neste chat (modo teste/piloto)."
                  }
                >
                  <Brain
                    className={cn(
                      "h-4 w-4",
                      conversaAtiva?.status === "bot" && "animate-pulse text-emerald-200",
                    )}
                  />
                  <span>{conversaAtiva?.status === "bot" ? "LIZ IA Ativa" : "Ativar LIZ IA"}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => reiniciar.mutate()}
                  disabled={reiniciar.isPending}
                  aria-label="Reiniciar LIZ e dar continuidade"
                  title="Reiniciar a LIZ e enviar mensagem de continuidade no chat"
                  className="hover:bg-primary/10 text-primary"
                >
                  {reiniciar.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => status.mutate("encerrar")}
                  aria-label="Encerrar"
                  title="Encerrar conversa"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div
                ref={scrollRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  coladoNoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                }}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 px-3 py-4"
              >
                {mensagens.isLoading && (
                  <div className="flex justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
                {mensagens.isError && (
                  <p className="mx-auto max-w-md rounded-lg bg-destructive/10 px-4 py-3 text-center text-xs text-destructive">
                    Não foi possível carregar as mensagens. Toque em atualizar para tentar de novo.
                  </p>
                )}
                {!mensagens.isLoading && !mensagens.isError && listaMensagens.length === 0 && (
                  <p className="mx-auto max-w-md rounded-lg bg-background px-4 py-3 text-center text-xs text-muted-foreground">
                    Sem histórico anterior disponível. O WhatsApp não devolve conversas antigas —
                    novas mensagens aparecem aqui automaticamente.
                  </p>
                )}

                {listaMensagens.length > 0 &&
                  (temMaisAntigas ? (
                    <div className="flex justify-center pb-2">
                      <Button variant="outline" size="sm" onClick={() => void carregarAnteriores()}>
                        <ChevronUp className="mr-2 h-4 w-4" />
                        Carregar mensagens anteriores
                      </Button>
                    </div>
                  ) : (
                    <p className="pb-2 text-center text-[11px] text-muted-foreground">
                      Início do histórico disponível
                    </p>
                  ))}

                {listaMensagens.map((m: any, i: number) => {
                  const meu = m.direction === "outbound";
                  const anterior = listaMensagens[i - 1];
                  const novoDia =
                    !anterior ||
                    new Date(anterior.occurred_at).toDateString() !==
                      new Date(m.occurred_at).toDateString();
                  return (
                    <div key={m.id}>
                      {novoDia && (
                        <p className="my-3 text-center text-[11px] text-muted-foreground">
                          {new Date(m.occurred_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      )}
                      <div className={cn("flex w-full", meu ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[78%] space-y-1 rounded-2xl px-3 py-2 text-sm shadow-sm",
                            meu
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm bg-background",
                          )}
                        >
                          <MensagemConteudo m={m} />
                          {m.status === "failed" && (
                            <p className="text-[11px] font-medium text-destructive">
                              Falha no envio{m.error ? `: ${m.error}` : ""}
                            </p>
                          )}
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
                              <CheckCheck
                                className={cn("h-3 w-3", m.status === "read" && "text-sky-300")}
                              />
                            )}
                            {meu && m.status === "failed" && (
                              <AlertCircle className="h-3 w-3 text-destructive" />
                            )}
                          </p>
                        </div>
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

/** Renderiza o conteúdo real de cada tipo de mensagem. */
function MensagemConteudo({ m }: { m: any }) {
  const url: string | null = m.media_url ?? null;
  const legenda = m.body ? (
    <p className="whitespace-pre-wrap break-words">{m.body}</p>
  ) : null;

  switch (m.msg_type) {
    case "image":
    case "sticker":
      return (
        <div className="space-y-1">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt={m.body || "Imagem recebida"}
                loading="lazy"
                className="max-h-72 w-full rounded-lg object-cover"
              />
            </a>
          ) : (
            <p className="flex items-center gap-2 text-xs opacity-80">
              <ImageIcon className="h-4 w-4" /> Imagem indisponível
            </p>
          )}
          {legenda}
        </div>
      );
    case "audio":
      return url ? (
        <audio controls src={url} className="w-56 max-w-full" />
      ) : (
        <p className="text-xs opacity-80">Áudio indisponível</p>
      );
    case "video":
      return (
        <div className="space-y-1">
          {url ? (
            <video controls src={url} className="max-h-72 w-full rounded-lg" />
          ) : (
            <p className="text-xs opacity-80">Vídeo indisponível</p>
          )}
          {legenda}
        </div>
      );
    case "document":
      return (
        <div className="space-y-1">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg bg-black/5 px-2 py-2 text-xs underline-offset-2 hover:underline dark:bg-white/10"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{m.media_filename || "Documento"}</span>
              <Download className="ml-auto h-4 w-4 shrink-0" />
            </a>
          ) : (
            <p className="flex items-center gap-2 text-xs opacity-80">
              <FileText className="h-4 w-4" /> {m.media_filename || "Documento indisponível"}
            </p>
          )}
          {legenda}
        </div>
      );
    case "location":
      return (
        <p className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0" />
          {m.body || "Localização compartilhada"}
        </p>
      );
    case "contact":
      return <p className="text-sm">👤 {m.body || "Contato compartilhado"}</p>;
    case "reaction":
      return <p className="text-lg">{m.body || "❤️"}</p>;
    case "unsupported":
      return (
        <p className="text-xs italic opacity-80">
          Mensagem do tipo “{m.raw_type || "desconhecido"}” ainda não suportada aqui. Abra no
          WhatsApp para visualizar.
        </p>
      );
    default:
      return legenda ?? <p className="text-xs italic opacity-80">Mensagem sem texto</p>;
  }
}
