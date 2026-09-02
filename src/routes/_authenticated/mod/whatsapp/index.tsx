import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  Bot,
  Brain,
  CheckCheck,
  ChevronDown,
  CircleDashed,
  DownloadCloud,
  Edit2,
  FilePlus,
  FileText,
  Flame,
  Headphones,
  Image as ImageIcon,
  KeyRound,
  Megaphone,
  MessageSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Pin,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Smile,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  claimWaConversation,
  getMyOrg,
  getWaInstanceStatus,
  listWaConversations,
  listWaMessages,
  requestPairingCode,
  sendWaManualMessage,
  sendWaMediaMessage,
  syncWaHistoricalChats,
  syncWaKnowledge,
} from "@/lib/wa-inbox.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mod/whatsapp/")({
  head: () => ({
    meta: [
      { title: "WhatsApp Web Oficial · LZ7 Energia" },
      {
        name: "description",
        content: "Central WhatsApp Web oficial da SDR Stephany Martins e LIZ IA.",
      },
    ],
  }),
  component: WhatsAppWebInbox,
});

const STATUS_TABS = [
  { key: "todos", label: "Todas" },
  { key: "humano", label: "👤 Stephany (SDR)" },
  { key: "bot", label: "🤖 LIZ IA" },
  { key: "encerrada", label: "Encerradas" },
] as const;

const DEFAULT_TEMPLATES = [
  {
    id: "1",
    label: "👋 Apresentação Stephany",
    shortcut: "/apresentacao",
    text: "Olá! Tudo bem? Aqui é a Stephany da LZ7 Energia Solar. Assumi seu atendimento para te passar os detalhes do seu projeto de economia!",
  },
  {
    id: "2",
    label: "📄 Pedir Fatura de Luz",
    shortcut: "/fatura",
    text: "Você teria fácil aí uma foto ou o PDF da sua última conta de luz? Nossos engenheiros conseguem analisar seu consumo histórico e dimensionar o projeto com 100% de exatidão!",
  },
  {
    id: "3",
    label: "⚡ Padrão 110V ou 220V",
    shortcut: "/110v",
    text: "Aí no seu imóvel a energia é 110V ou 220V? Isso nos ajuda a identificar se a sua rede é monofásica, bifásica ou trifásica.",
  },
  {
    id: "4",
    label: "☀️ Estudo Solar Pronto",
    shortcut: "/estudo",
    text: "Ótima notícia! Nosso setor de engenharia acabou de finalizar o seu estudo solar personalizado com até 95% de economia. Posso te apresentar agora?",
  },
  {
    id: "5",
    label: "📅 Agendar Visita Técnica",
    shortcut: "/visita",
    text: "Que tal agendarmos uma visita técnica 100% gratuita no seu imóvel com um de nossos especialistas para avaliar o telhado e a rede elétrica?",
  },
  {
    id: "6",
    label: "🏦 Financiamento sem Entrada",
    shortcut: "/financiamento",
    text: "Trabalhamos com linhas de financiamento em até 84x onde a parcela da usina é paga com a própria economia da conta de luz, sem precisar tirar dinheiro do bolso!",
  },
];

const EMOJIS = ["😀", "😊", "👍", "☀️", "⚡", "📄", "🙏", "👏", "💰", "🤝", "🏡", "📍", "⏰", "🚀", "✅"];

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

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function WhatsAppWebInbox() {
  const orgFn = useServerFn(getMyOrg);
  const listFn = useServerFn(listWaConversations);
  const msgFn = useServerFn(listWaMessages);
  const claimFn = useServerFn(claimWaConversation);
  const sendFn = useServerFn(sendWaManualMessage);
  const sendMediaFn = useServerFn(sendWaMediaMessage);
  const instanceStatusFn = useServerFn(getWaInstanceStatus);
  const pairingCodeFn = useServerFn(requestPairingCode);
  const syncKnowledgeFn = useServerFn(syncWaKnowledge);
  const syncHistoryFn = useServerFn(syncWaHistoricalChats);
  const qc = useQueryClient();

  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["key"]>("todos");
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "favorites">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [pairingPhoneInput, setPairingPhoneInput] = useState("554399760685");
  const [generatedPairingCode, setGeneratedPairingCode] = useState<string | null>(null);

  // Respostas Rápidas gerenciáveis
  const [quickTemplates, setQuickTemplates] = useState(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("lz7_wa_templates") : null;
      return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  });

  const [editingTemplate, setEditingTemplate] = useState<{ id?: string; label: string; text: string; shortcut: string } | null>(null);

  const saveTemplates = (templates: typeof quickTemplates) => {
    setQuickTemplates(templates);
    try {
      localStorage.setItem("lz7_wa_templates", JSON.stringify(templates));
    } catch {}
  };

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de Gravação de Áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const org = useQuery({ queryKey: ["my-org"], queryFn: () => orgFn({}) });
  const orgId = org.data?.id;

  const instanceStatus = useQuery({
    queryKey: ["wa-instance-status", orgId],
    queryFn: () => instanceStatusFn({ data: { orgId } }),
    refetchInterval: 10_000,
  });

  const pairingMutation = useMutation({
    mutationFn: (phone: string) => pairingCodeFn({ data: { phone } }),
    onSuccess: (res) => {
      setGeneratedPairingCode(res.pairingCode);
      toast.success("Código de pareamento de 8 dígitos gerado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const knowledgeMutation = useMutation({
    mutationFn: () => syncKnowledgeFn({}),
    onSuccess: () => {
      setKnowledgeDialogOpen(true);
      toast.success("Histórico comercial analisado e sincronizado com a IA LIZ!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Função de Som Oficial do WhatsApp (Web Audio API nativo)
  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1046.5, now + 0.1);
      gain2.gain.setValueAtTime(0.35, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.45);
    } catch {}
  };

  const syncHistoryMutation = useMutation({
    mutationFn: () => syncHistoryFn({}),
    onSuccess: (res) => {
      toast.success(res.message || "Histórico completo importado!");
      qc.invalidateQueries({ queryKey: ["wa-conversations"] });
      if (selected) qc.invalidateQueries({ queryKey: ["wa-messages", selected] });
    },
    onError: (e: Error) => toast.error(`Erro ao sincronizar: ${e.message}`),
  });

  const conversations = useQuery({
    queryKey: ["wa-conversations", orgId, status, search],
    queryFn: () => listFn({ data: { orgId, status, search: search || undefined } }),
    refetchInterval: 2_000,
  });

  const messages = useQuery({
    queryKey: ["wa-messages", selected],
    queryFn: () => msgFn({ data: { conversationId: selected! } }),
    enabled: !!selected,
    refetchInterval: 2_000,
  });

  // Realtime Supabase Subscription & Alerta Sonoro
  useEffect(() => {
    const channel = supabase
      .channel("wa-live-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wa_messages" },
        (payload) => {
          const newMsg = payload.new as any;
          qc.invalidateQueries({ queryKey: ["wa-conversations"] });
          if (newMsg.conversation_id) {
            qc.invalidateQueries({ queryKey: ["wa-messages", newMsg.conversation_id] });
          }
          if (newMsg.direction === "inbound") {
            playNotificationSound();
            toast.info(`🔔 Nova mensagem de Lead: ${newMsg.body?.slice(0, 45) || "Mensagem recebida"}`);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_conversations" },
        () => {
          qc.invalidateQueries({ queryKey: ["wa-conversations"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages.data?.length, selected]);

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

  const sendMedia = useMutation({
    mutationFn: (params: {
      type: "image" | "document" | "audio" | "video";
      base64Data: string;
      fileName: string;
      mimeType: string;
      caption?: string;
    }) => sendMediaFn({ data: { conversationId: selected!, ...params } }),
    onSuccess: () => {
      toast.success("Arquivo / Áudio enviado com sucesso no WhatsApp!");
      qc.invalidateQueries({ queryKey: ["wa-messages", selected] });
      qc.invalidateQueries({ queryKey: ["wa-conversations"] });
    },
    onError: (e: Error) => toast.error(`Erro ao enviar mídia: ${e.message}`),
  });

  // Gravação de Áudio no Navegador
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      toast.error("Permissão de microfone negada ou indisponível.");
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingSeconds(0);
      audioChunksRef.current = [];
      toast.info("Gravação cancelada.");
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    mediaRecorderRef.current.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);

    setTimeout(() => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        sendMedia.mutate({
          type: "audio",
          base64Data,
          fileName: `audio_${Date.now()}.webm`,
          mimeType: "audio/webm",
          caption: "[Áudio de voz gravado pela SDR]",
        });
      };
      reader.readAsDataURL(audioBlob);
      setRecordingSeconds(0);
      audioChunksRef.current = [];
    }, 300);
  };

  // Upload de Arquivos / Fotos / PDFs
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error("O arquivo excede o limite de 20MB.");
      return;
    }

    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    const isAud = file.type.startsWith("audio/");
    const mediaType: "image" | "video" | "audio" | "document" = isImg
      ? "image"
      : isVid
        ? "video"
        : isAud
          ? "audio"
          : "document";

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      sendMedia.mutate({
        type: mediaType,
        base64Data,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        caption: draft.trim() || undefined,
      });
      setDraft("");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (draft.trim() && !send.isPending) {
       send.mutate();
      }
    }
  };

  const current = conversations.data?.find((c) => c.id === selected);

  // Filtros de conversa do WhatsApp Web
  const filteredConversations = (conversations.data || []).filter((c) => {
    if (activeTab === "unread") return (c.unread || 0) > 0;
    if (activeTab === "favorites") return c.status === "bot";
    return true;
  });

  return (
    <div className="mx-auto flex h-[calc(100vh-70px)] w-full max-w-[1700px] flex-col overflow-hidden p-0 sm:p-2">
      {/* Moldura Global do WhatsApp Web */}
      <div className="flex h-full w-full overflow-hidden rounded-none sm:rounded-xl border border-[#d1d7db] bg-white shadow-xl dark:border-[#222e35] dark:bg-[#111b21]">
        
        {/* 1. BARRA VERTICAL DE ÍCONES (EXTREMA ESQUERDA - WhatsApp Web Oficial) */}
        <div className="flex w-14 shrink-0 flex-col items-center justify-between border-r border-[#e9edef] bg-[#f0f2f5] py-3.5 dark:border-[#222e35] dark:bg-[#202c33]">
          {/* Topo da barra de navegação */}
          <div className="flex flex-col items-center gap-4">
            {/* Botão Conversas (Ativo) com Badge Verde */}
            <button
              onClick={() => setActiveTab("all")}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#d9fdd3] text-[#005c4b] transition-colors dark:bg-[#005c4b]/30 dark:text-[#25d366]"
              title="Conversas"
            >
              <MessageSquare className="h-5 w-5 fill-current" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25d366] px-1 text-[10px] font-bold text-white">
                2
              </span>
            </button>

            {/* Chamadas */}
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21] transition-colors dark:text-[#aebac1] dark:hover:bg-[#111b21]"
              title="Ligações e Chamadas"
            >
              <Phone className="h-5 w-5" />
            </button>

            {/* Status com pontinho verde */}
            <button
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21] transition-colors dark:text-[#aebac1] dark:hover:bg-[#111b21]"
              title="Status"
            >
              <CircleDashed className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#25d366]" />
            </button>

            {/* Canais */}
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21] transition-colors dark:text-[#aebac1] dark:hover:bg-[#111b21]"
              title="Canais"
            >
              <Radio className="h-5 w-5" />
            </button>

            {/* Comunidades */}
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21] transition-colors dark:text-[#aebac1] dark:hover:bg-[#111b21]"
              title="Comunidades"
            >
              <Users className="h-5 w-5" />
            </button>

            {/* Ferramentas Comerciais com pontinho verde */}
            <button
              onClick={() => setTemplatesDialogOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21] transition-colors dark:text-[#aebac1] dark:hover:bg-[#111b21]"
              title="Ferramentas Comerciais & Respostas Rápidas"
            >
              <Store className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#25d366]" />
            </button>

            {/* Anúncios / Campanhas */}
            <button
              onClick={() => knowledgeMutation.mutate()}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21] transition-colors dark:text-[#aebac1] dark:hover:bg-[#111b21]"
              title="Treinar Inteligência LIZ IA com Histórico"
            >
              <Brain className={cn("h-5 w-5", knowledgeMutation.isPending && "animate-spin text-[#00a884]")} />
            </button>
          </div>

          {/* Rodapé da barra de navegação */}
          <div className="flex flex-col items-center gap-3">
            {/* Galeria / Mídia */}
            <button
              onClick={() => syncHistoryMutation.mutate()}
              disabled={syncHistoryMutation.isPending}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21] transition-colors dark:text-[#aebac1] dark:hover:bg-[#111b21]"
              title="Puxar Todo o Histórico de Mensagens e Leads"
            >
              <DownloadCloud className={cn("h-5 w-5", syncHistoryMutation.isPending && "animate-spin text-[#00a884]")} />
            </button>

            {/* Configurações / QR Code */}
            <button
              onClick={() => setQrDialogOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21] transition-colors dark:text-[#aebac1] dark:hover:bg-[#111b21]"
              title="Conexão do Aparelho (QR Code)"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* Avatar do Usuário / LZ7 */}
            <Avatar className="h-8 w-8 cursor-pointer border border-[#00a884]" onClick={() => setQrDialogOpen(true)}>
              <AvatarFallback className="bg-[#005c4b] text-[10px] font-black text-white">LZ7</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* 2. COLUNA DE CHATS (BARRA LATERAL DE CONVERSAS) */}
        <div className="flex w-[380px] sm:w-[410px] shrink-0 flex-col border-r border-[#e9edef] bg-white dark:border-[#222e35] dark:bg-[#111b21]">
          
          {/* Header do WhatsApp (Título Oficial e Botão de Nova Conversa) */}
          <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
            <h1 className="text-xl font-bold tracking-tight text-[#111b21] dark:text-[#e9edef]">
              WhatsApp
            </h1>
            
            <div className="flex items-center gap-2">
              {/* Botão Quadrado com + para Nova Conversa */}
              <button
                onClick={() => setTemplatesDialogOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111b21] text-white hover:bg-[#202c33] transition-colors dark:bg-white dark:text-[#111b21]"
                title="Nova Conversa / Respostas Rápidas"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
              </button>

              {/* Menu de Mais Opções */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full text-[#54656f] hover:bg-[#f0f2f5] dark:text-[#aebac1] dark:hover:bg-[#202c33]">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 text-xs">
                  <DropdownMenuItem onClick={() => syncHistoryMutation.mutate()} className="cursor-pointer">
                    <DownloadCloud className="mr-2 h-4 w-4 text-[#00a884]" /> Puxar Histórico Completo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => knowledgeMutation.mutate()} className="cursor-pointer">
                    <Brain className="mr-2 h-4 w-4 text-[#00a884]" /> Treinar LIZ com Conversas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTemplatesDialogOpen(true)} className="cursor-pointer">
                    <Zap className="mr-2 h-4 w-4 text-amber-500" /> Respostas Rápidas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQrDialogOpen(true)} className="cursor-pointer">
                    <QrCode className="mr-2 h-4 w-4 text-blue-500" /> Conectar Celular Stephany
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Barra de Busca de Conversas */}
          <div className="px-3 py-1.5">
            <div className="relative flex items-center rounded-lg bg-[#f0f2f5] px-3 py-1.5 dark:bg-[#202c33]">
              <Search className="mr-3 h-4 w-4 text-[#54656f] dark:text-[#aebac1]" />
              <input
                type="text"
                placeholder="Pesquisar ou começar uma nova conversa"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-[#111b21] placeholder-[#54656f] outline-none dark:text-[#e9edef] dark:placeholder-[#aebac1]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-[#54656f] hover:text-[#111b21]">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filtros em Pílula (Tudo, Não lidas 2, Favoritas, Grupos) */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#e9edef] dark:border-[#222e35]">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeTab === "all"
                  ? "bg-[#e7fce3] text-[#008069] font-semibold dark:bg-[#005c4b]/30 dark:text-[#25d366]"
                  : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef] dark:bg-[#202c33] dark:text-[#aebac1]",
              )}
            >
              Tudo
            </button>

            <button
              onClick={() => setActiveTab("unread")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeTab === "unread"
                  ? "bg-[#e7fce3] text-[#008069] font-semibold dark:bg-[#005c4b]/30 dark:text-[#25d366]"
                  : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef] dark:bg-[#202c33] dark:text-[#aebac1]",
              )}
            >
              Não lidas 2
            </button>

            <button
              onClick={() => setActiveTab("favorites")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeTab === "favorites"
                  ? "bg-[#e7fce3] text-[#008069] font-semibold dark:bg-[#005c4b]/30 dark:text-[#25d366]"
                  : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef] dark:bg-[#202c33] dark:text-[#aebac1]",
              )}
            >
              Favoritas
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className="flex items-center gap-1 rounded-full bg-[#f0f2f5] px-2.5 py-1 text-xs text-[#54656f] hover:bg-[#e9edef] dark:bg-[#202c33] dark:text-[#aebac1]"
            >
              Grupos <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {/* Item Arquivadas (WhatsApp Web) */}
          <div className="flex items-center justify-between px-4 py-2.5 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]/50 cursor-pointer border-b border-[#e9edef]/60 dark:border-[#222e35]/60">
            <div className="flex items-center gap-3">
              <Archive className="h-4 w-4 text-[#54656f] dark:text-[#aebac1]" />
              <span className="text-xs font-medium text-[#111b21] dark:text-[#e9edef]">Arquivadas</span>
            </div>
          </div>

          {/* Lista de Conversas Real */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {conversations.isLoading ? (
              <div className="flex items-center justify-center p-8 text-xs text-[#54656f]">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin text-[#00a884]" /> Carregando conversas...
              </div>
            ) : !filteredConversations.length ? (
              <div className="p-8 text-center text-xs text-[#54656f]">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-30" />
                Nenhuma conversa encontrada.
              </div>
            ) : (
              <div className="divide-y divide-[#e9edef]/40 dark:divide-[#222e35]/40">
                {filteredConversations.map((c, idx) => {
                  const isSel = c.id === selected;
                  const formatted = formatPhone(c.phone);

                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                        isSel
                          ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
                          : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]/70",
                      )}
                    >
                      {/* Avatar do Contato */}
                      <Avatar className="h-12 w-12 shrink-0 border border-border/40">
                        <AvatarFallback className="bg-[#54656f] text-xs font-bold text-white">
                          {getInitials(c.name || c.phone)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Informações da Conversa */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">
                              {c.name || formatted}
                            </span>
                            {/* Tags / Etiquetas coloridas do WhatsApp Business */}
                            {idx % 2 === 0 ? (
                              <span className="flex items-center gap-0.5 text-[10px]">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
                              </span>
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
                            )}
                          </div>

                          <span className="shrink-0 text-[11px] text-[#667781] dark:text-[#8696a0]">
                            {c.lastMessageAt
                              ? new Date(c.lastMessageAt).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "14:09"}
                          </span>
                        </div>

                        <div className="mt-0.5 flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            {/* Ticks de entrega / leitura para mensagens enviadas */}
                            {c.status === "humano" && (
                              <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#53bdeb]" />
                            )}
                            <p className="truncate text-xs text-[#667781] dark:text-[#8696a0]">
                              {c.summary || "os meses vem em torno de 215 a 240."}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Badge verde de mensagens não lidas */}
                            {c.unread ? (
                              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25d366] px-1 text-[10px] font-bold text-white">
                                {c.unread}
                              </span>
                            ) : idx === 2 ? (
                              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25d366] px-1 text-[10px] font-bold text-white">
                                1
                              </span>
                            ) : idx < 2 ? (
                              <Pin className="h-3.5 w-3.5 text-[#8696a0]" />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3. COLUNA DA DIREITA: ÁREA DO CHAT ATIVO AO VIVO */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#efeae2] dark:bg-[#0b141a]">
          {!selected ? (
            /* Tela Vazia WhatsApp Web */
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00a884] text-white shadow-md">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <h2 className="font-heading text-base font-bold text-foreground">
                      WhatsApp Web LZ7 Energia
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Conectado ao celular oficial da SDR Stephany Martins
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs text-muted-foreground">
                    Selecione qualquer contato na lista à esquerda para conversar e enviar faturas!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Header do Chat Ativo (Identico ao WhatsApp Web) */}
              <div className="shrink-0 flex items-center justify-between border-b border-[#e9edef] bg-[#f0f2f5] px-4 py-2 dark:border-[#222e35] dark:bg-[#202c33] z-10">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border/40">
                    <AvatarFallback className="bg-[#54656f] text-xs font-bold text-white">
                      {current?.name ? getInitials(current.name) : "C"}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">
                        {current?.name || formatPhone(current?.phone || "")}
                      </h3>
                      {/* Pill de Etiquetas do WhatsApp Business */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-1 rounded-full border border-[#d1d7db] bg-white px-2.5 py-0.5 text-[10px] font-semibold text-[#111b21] hover:bg-[#f0f2f5] dark:border-[#374248] dark:bg-[#111b21] dark:text-[#e9edef]">
                            <span className="flex items-center gap-0.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
                            </span>
                            <span>2 selecionadas</span>
                            <ChevronDown className="h-3 w-3 text-[#54656f]" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 text-xs">
                          <DropdownMenuItem onClick={() => claim.mutate("assumir")}>
                            👤 Stephany (SDR)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => claim.mutate("devolver")}>
                            🤖 LIZ IA
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => claim.mutate("encerrar")}>
                            ❌ Encerrar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* Ícones de Ação à Direita no Topo */}
                <div className="flex items-center gap-3 text-[#54656f] dark:text-[#aebac1]">
                  <button className="p-1 hover:text-[#111b21] transition-colors" title="Chamada de Vídeo">
                    <Video className="h-5 w-5" />
                  </button>
                  <button className="p-1 hover:text-[#111b21] transition-colors" title="Chamada de Voz">
                    <Phone className="h-5 w-5" />
                  </button>
                  <button className="p-1 hover:text-[#111b21] transition-colors" title="Pesquisar na Conversa">
                    <Search className="h-5 w-5" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 hover:text-[#111b21] transition-colors" title="Mais Opções">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      <DropdownMenuItem onClick={() => claim.mutate("assumir")}>
                        <UserCheck className="mr-2 h-4 w-4 text-amber-600" /> Assumir Atendimento
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => claim.mutate("devolver")}>
                        <Bot className="mr-2 h-4 w-4 text-emerald-600" /> Devolver para LIZ IA
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => claim.mutate("encerrar")}>
                        <UserMinus className="mr-2 h-4 w-4 text-destructive" /> Encerrar Conversa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Mensagens do Chat com Rolagem Própria */}
              <div
                ref={messagesContainerRef}
                className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#202c33_1px,transparent_1px)]"
              >
                {messages.isLoading ? (
                  <div className="flex items-center justify-center p-8 text-xs text-[#54656f]">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin text-[#00a884]" /> Carregando mensagens...
                  </div>
                ) : !messages.data?.length ? (
                  <div className="p-8 text-center text-xs text-[#54656f]">
                    Nenhuma mensagem registrada nesta conversa ainda.
                  </div>
                ) : (
                  messages.data.map((m) => {
                    const isInbound = m.direction === "inbound";
                    const isPdf = m.msg_type === "document" || m.body?.includes(".pdf");

                    return (
                      <div
                        key={m.id}
                        className={cn("flex w-full", isInbound ? "justify-start" : "justify-end")}
                      >
                        <div
                          className={cn(
                            "relative max-w-[85%] rounded-lg px-3 py-1.5 text-sm shadow-xs sm:max-w-[65%]",
                            isInbound
                              ? "rounded-tl-none bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]"
                              : "rounded-tr-none bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]",
                          )}
                        >
                          {/* Card de Fatura / PDF Neoenergia Elektro */}
                          {isPdf ? (
                            <div className="space-y-2 py-1">
                              <div className="overflow-hidden rounded-md border border-border/40 bg-white/90 p-2 dark:bg-black/20">
                                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                                  <span>Neoenergia Elektro</span>
                                  <span className="text-[10px] text-muted-foreground">Segunda Via</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2 rounded bg-black/5 p-2 dark:bg-white/5">
                                  <FileText className="h-6 w-6 text-red-600" />
                                  <div className="min-w-0 flex-1 text-xs">
                                    <p className="truncate font-semibold">{m.body || "fatura_luz.pdf"}</p>
                                    <p className="text-[10px] text-[#667781]">2 páginas • PDF • 894 KB</p>
                                  </div>
                                  <button className="text-[#54656f] hover:text-[#111b21]">
                                    <Share2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{m.body}</p>
                          )}

                          {/* Horário e Checkmarks do WhatsApp */}
                          <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781] dark:text-[#8696a0]">
                            <span>
                              {new Date(m.occurred_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {!isInbound && (
                              <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Atalhos Rápidos Discretos */}
              <div className="shrink-0 border-t border-[#e9edef] bg-[#f0f2f5] px-3 py-1.5 dark:border-[#222e35] dark:bg-[#202c33]">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#667781]">
                    ATALHOS:
                  </span>
                  {quickTemplates.map((tmpl: any) => (
                    <button
                      key={tmpl.id || tmpl.label}
                      onClick={() => setDraft(tmpl.text)}
                      className="h-6 shrink-0 rounded-full border border-[#d1d7db] bg-white px-2.5 text-[11px] font-medium text-[#111b21] hover:border-[#00a884] hover:text-[#00a884] dark:border-[#374248] dark:bg-[#111b21] dark:text-[#e9edef]"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setTemplatesDialogOpen(true)}
                    className="h-6 shrink-0 text-[11px] font-semibold text-[#00a884] hover:underline px-1"
                  >
                    + Gerenciar
                  </button>
                </div>
              </div>

              {/* Composer (Barra de Digitação Oficial do WhatsApp Web) */}
              <div className="shrink-0 bg-[#f0f2f5] px-3 py-2.5 dark:bg-[#202c33]">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,video/*,application/pdf"
                />

                {isRecording ? (
                  /* Modo Gravação */
                  <div className="flex h-[42px] items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
                      </span>
                      <span className="text-xs font-semibold text-red-600">
                        Gravando: {formatDuration(recordingSeconds)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={cancelRecording} className="text-xs text-muted-foreground hover:text-red-600">
                        Cancelar
                      </button>
                      <button
                        onClick={stopAndSendRecording}
                        className="rounded-full bg-[#00a884] px-3 py-1 text-xs font-semibold text-white"
                      >
                        Enviar Áudio
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Composer Padrão WhatsApp Web */
                  <div className="flex items-center gap-2">
                    {/* Botão de Anexo Clips 📎 */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] dark:text-[#aebac1] dark:hover:bg-[#111b21]"
                      title="Anexar arquivo ou fatura"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>

                    {/* Botão de Emojis 😀 */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] dark:text-[#aebac1] dark:hover:bg-[#111b21]"
                          title="Inserir Emoji"
                        >
                          <Smile className="h-5 w-5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" align="start">
                        <div className="grid grid-cols-5 gap-1 text-center">
                          {EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => setDraft((prev) => prev + emoji)}
                              className="rounded p-1 text-xl hover:bg-muted"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Input de Texto Arredondado */}
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && draft.trim()) {
                          send.mutate();
                        }
                      }}
                      placeholder="Digite uma mensagem"
                      className="h-[42px] flex-1 rounded-lg bg-white px-3.5 text-xs text-[#111b21] placeholder-[#54656f] outline-none shadow-2xs dark:bg-[#111b21] dark:text-[#e9edef] dark:placeholder-[#aebac1]"
                    />

                    {/* Microfone ou Enviar */}
                    {draft.trim() ? (
                      <button
                        onClick={() => send.mutate()}
                        disabled={send.isPending}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white hover:bg-[#008f6f] transition-colors"
                        title="Enviar mensagem"
                      >
                        {send.isPending ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      </button>
                    ) : (
                      <button
                        onClick={startRecording}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656f] hover:bg-[#e9edef] dark:text-[#aebac1] dark:hover:bg-[#111b21]"
                        title="Gravar áudio"
                      >
                        <Mic className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Modal: Gerenciar Respostas Rápidas */}
      <Dialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Zap className="h-5 w-5 text-emerald-600" />
              Respostas Rápidas & Atalhos
            </DialogTitle>
            <DialogDescription className="text-xs">
              Crie e edite respostas prontas para a Stephany enviar com 1 clique no chat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {editingTemplate ? (
              <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <p className="text-xs font-bold text-foreground">
                  {editingTemplate.id ? "Editar Resposta Rápida" : "Nova Resposta Rápida"}
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="Título do botão (ex: 📄 Pedir Fatura)"
                    value={editingTemplate.label}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, label: e.target.value })}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Atalho (ex: /fatura)"
                    value={editingTemplate.shortcut}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, shortcut: e.target.value })}
                    className="text-xs font-mono"
                  />
                  <Textarea
                    placeholder="Texto completo que será enviado..."
                    value={editingTemplate.text}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, text: e.target.value })}
                    className="text-xs"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingTemplate(null)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!editingTemplate.label || !editingTemplate.text) {
                        toast.error("Preencha título e texto");
                        return;
                      }
                      if (editingTemplate.id) {
                        saveTemplates(
                          quickTemplates.map((t: any) =>
                            t.id === editingTemplate.id ? { ...editingTemplate } : t,
                          ),
                        );
                      } else {
                        saveTemplates([
                          ...quickTemplates,
                          { ...editingTemplate, id: Date.now().toString() },
                        ]);
                      }
                      setEditingTemplate(null);
                      toast.success("Resposta rápida salva!");
                    }}
                    className="bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                  >
                    Salvar Resposta
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setEditingTemplate({ label: "", shortcut: "/", text: "" })}
                className="w-full bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Criar Nova Resposta Rápida
              </Button>
            )}

            <ScrollArea className="max-h-60">
              <div className="space-y-2">
                {quickTemplates.map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{t.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{t.shortcut}</span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">{t.text}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingTemplate({ ...t })}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          saveTemplates(quickTemplates.filter((item: any) => item.id !== t.id));
                          toast.success("Resposta removida.");
                        }}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Base de Conhecimento da LIZ IA */}
      <Dialog open={knowledgeDialogOpen} onOpenChange={setKnowledgeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Brain className="h-5 w-5 text-emerald-600" />
              Base de Conhecimento da LIZ IA
            </DialogTitle>
            <DialogDescription className="text-xs">
              A inteligência comercial sintetizada a partir de todas as conversas reais da Stephany.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-4 w-4" /> Aprendizado Comercial Concluído
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                A LIZ IA absorveu as objeções, padrões de dúvidas e as melhores abordagens da Stephany para responder com precisão cirúrgica quando autorizada.
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap leading-relaxed">
              {knowledgeMutation.data?.summary || "Carregando resumo do conhecimento..."}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Conexão QR Code */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              Conexão WhatsApp Web (Celular + IA)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Conecte o WhatsApp do celular da Stephany ao Solar OS. O celular continua livre para ligações no app verdinho!
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="qrcode" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="qrcode" className="text-xs">
                <QrCode className="mr-1.5 h-3.5 w-3.5" /> Ler QR Code
              </TabsTrigger>
              <TabsTrigger value="pairing" className="text-xs">
                <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Pareamento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="qrcode" className="space-y-4 pt-2">
              <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/30 p-6 text-center">
                {instanceStatus.data?.status === "connected" ? (
                  <div className="space-y-2 py-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600">
                      <CheckCheck className="h-8 w-8" />
                    </div>
                    <h3 className="font-heading text-base font-bold text-foreground">
                      WhatsApp Conectado com Sucesso!
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      O celular da Stephany (+55 43 9976-0685) está pareado 24/7.
                    </p>
                  </div>
                ) : instanceStatus.data?.qrCode ? (
                  <>
                    <div className="rounded-lg bg-white p-3 shadow-sm">
                      {instanceStatus.data.qrCode.startsWith("data:image") ||
                      instanceStatus.data.qrCode.startsWith("http") ? (
                        <img
                          src={instanceStatus.data.qrCode}
                          className="h-48 w-48 rounded-lg"
                          alt="QR Code WhatsApp"
                        />
                      ) : (
                        <QRCodeSVG value={instanceStatus.data.qrCode} size={190} level="M" />
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-4 w-4" /> QR Code Oficial WhatsApp Web (24/7 Nuvem)
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
                    <span>Gerando QR Code exclusivo do WhatsApp...</span>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="pairing" className="space-y-4 pt-2">
              <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">
                  Digite o número com DDD para receber o código no WhatsApp do celular:
                </p>
                <div className="flex gap-2">
                  <Input
                    value={pairingPhoneInput}
                    onChange={(e) => setPairingPhoneInput(e.target.value)}
                    placeholder="554399760685"
                    className="text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={() => pairingMutation.mutate(pairingPhoneInput)}
                    disabled={pairingMutation.isPending}
                    className="bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    {pairingMutation.isPending ? "Gerando..." : "Gerar Código"}
                  </Button>
                </div>

                {generatedPairingCode && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Código de Pareamento:</p>
                    <p className="font-mono text-2xl font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
                      {generatedPairingCode}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
