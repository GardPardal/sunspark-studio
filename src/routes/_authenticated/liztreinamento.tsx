import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Send,
  Sparkles,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  BookOpen,
  Bot,
  User,
  Loader2,
  RefreshCw,
  Radio,
  Zap,
  Power,
  MessageSquare,
  Terminal,
  ExternalLink,
  Megaphone,
  Check,
  AlertCircle,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { LizHackerTerminal } from "@/components/liz-hacker-terminal";

export const Route = createFileRoute("/_authenticated/liztreinamento")({
  head: () => ({
    meta: [
      { title: "Treine a LIZ — Sala de Treinamento e Memória da IA" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LizTrainingPage,
});

export interface LizLearningItem {
  id: string;
  categoria: string;
  titulo: string;
  conteudo: string;
  contexto: string | null;
  tags: string[];
  usos: number;
  created_at: string;
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  savedLearning?: LizLearningItem | null;
  timestamp: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  argumento: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
  objecao: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
  dado_tecnico: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
  tarifa: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
  regiao: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300",
  dica_venda: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300",
  tom_de_voz: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300",
  geral: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200",
};

const PRESET_PROMPTS = [
  {
    title: "Financiamento sem entrada",
    prompt:
      "Liz, quando o cliente perguntar sobre financiamento, diga que temos parcelamento em até 120x sem entrada e até 120 dias para começar a pagar.",
  },
  {
    title: "Garantia dos painéis",
    prompt:
      "Liz, se o cliente tiver dúvida de durabilidade, enfatize que os painéis têm garantia de eficiência de 25 anos e os inversores têm garantia nacional de fábrica.",
  },
  {
    title: "Usinas na região (Norte Pioneiro)",
    prompt:
      "Liz, quando o cliente for de cidades do Norte Pioneiro (como Wenceslau Braz, Tomazina, Ibaiti, Siqueira Campos), mencione com orgulho que já temos centenas de usinas instaladas na região!",
  },
  {
    title: "Objeção: Achei caro",
    prompt:
      "Liz, se o cliente disser que achou caro ou que não tem dinheiro agora, explique que o financiamento solar substitui a conta de luz: a parcela fica no mesmo valor que ele já paga para a Copel, e depois de quitado a energia fica de graça por décadas!",
  },
];

const PRELOADED_PHONES = "5543999237990\\n5543998010011\\n5543999063007\\n5543999512890\\n5543998590053\\n5543996172509\\n5542999750412\\n5542999218576\\n5543998138806\\n5543999064484\\n5543984266655\\n5543996777128\\n5543984621696\\n5543996940329\\n5543999760894\\n5543984612012\\n5543998650114\\n5542999302862\\n5542991355581\\n5543996860012\\n5542998316027\\n5543996611492\\n5543999760139\\n5543996848780\\n5543999760030\\n5542999616658\\n5543998509187\\n5543988181004\\n5543999760104\\n5543996895935\\n5543999785871\\n5543996940064\\n5542999302672\\n5543999760715\\n5543999263439\\n5543984125450\\n5543984525923\\n5543999388766";
const PRELOADED_MESSAGE = "Olá, time LZ7! 👋⚡\\n\\nEu sou a **Liz**, a nova SDR Digital da LZ7 GROUP, criada pelo Alison para fortalecer e melhorar o atendimento dos nossos leads.\\n\\nMinha missão é ajudar a garantir o melhor atendimento e a melhor qualificação possível: organizar as informações, agilizar o primeiro contato e entregar aos vendedores oportunidades mais preparadas para avançar e fechar negócio.\\n\\nA empresa não está poupando esforços para transformar a **LZ7 GROUP em uma empresa modelo para trabalhar**, com tecnologia, organização, oportunidades e crescimento para todos.\\n\\nÉ importante lembrar: atender bem os leads que chegam pelo tráfego pago significa aproveitar oportunidades nas quais a empresa já investiu. Na prática, isso representa **vender mais, com menos esforço de prospecção, mais produtividade e mais dinheiro no bolso**. 💰🚀\\n\\nAgradeço de verdade por todo o esforço, dedicação e trabalho realizado por vocês até aqui. Cada atendimento faz diferença e cada venda ajuda a construir o próximo nível da nossa empresa.\\n\\nA nova era digital chegou à LZ7!\\n\\n**Hasta la vista, atendimento lento.** 🤖🔥\\n\\nContem comigo!\\n\\n**Liz — SDR Digital da LZ7 GROUP**";

function LizTrainingPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"treino" | "terminal" | "memoria">("treino");
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Olá, Stephany! Me chamo LIZ e estou pronta para ser treinada por você. ☀️\n\nPode me orientar livremente: como devo falar com os clientes, quais argumentos usar, como tirar dúvidas de financiamento ou como contornar objeções.\n\nTudo o que você me ensinar aqui eu gravo na minha memória e aplico na hora no WhatsApp com os clientes reais! O que gostaria de me ensinar agora?",
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isGlobalConfirmOpen, setIsGlobalConfirmOpen] = useState(false);

  // Broadcast Modal State
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastPhonesText, setBroadcastPhonesText] = useState(PRELOADED_PHONES);
  const [broadcastMessage, setBroadcastMessage] = useState(PRELOADED_MESSAGE);
  const [broadcastDelay, setBroadcastDelay] = useState<number>(3);
  const abortBroadcastRef = useRef(false);

  const [broadcastProgress, setBroadcastProgress] = useState<{
    running: boolean;
    total: number;
    current: number;
    sent: number;
    failed: number;
    currentPhone?: string;
    logs: Array<{ phone: string; formattedPhone?: string; status: "sent" | "failed"; messageId?: string | null; error?: string }>;
  }>({
    running: false,
    total: 0,
    current: 0,
    sent: 0,
    failed: 0,
    logs: [],
  });

  // Manual rule state
  const [manualTitle, setManualTitle] = useState("");
  const [manualCategory, setManualCategory] = useState("argumento");
  const [manualContent, setManualContent] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch status da LIZ e métricas do dia
  const { data: lizStatus } = useQuery({
    queryKey: ["liz_global_status"],
    queryFn: async () => {
      const res = await fetch("/api/public/liz-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_status" }),
      });
      if (res.ok) return await res.json();
      return { isGlobalEnabled: false, todayHumanMsgs: 0, todayLearnings: 0, activeConvs: 0, botConvs: 0 };
    },
    refetchInterval: 15000,
  });

  // Sincronizar conversas de hoje mutation
  const syncTodayMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/liz-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_today" }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Erro ao sincronizar aprendizados de hoje");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast.success(
        `✅ Aprendizado Concluído: ${data.totalConversationsAnalyzed} conversas analisadas e ${data.learningsExtracted} novas regras absorvidas!`,
      );
      queryClient.invalidateQueries({ queryKey: ["liz_learnings"] });
      queryClient.invalidateQueries({ queryKey: ["liz_global_status"] });
      queryClient.invalidateQueries({ queryKey: ["liz_neural_logs"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao sincronizar.");
    },
  });

  // Toggle Global Mode mutation
  const toggleGlobalMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch("/api/public/liz-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_global", enabled }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Erro ao alterar modo da LIZ");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || "Modo atualizado!");
      queryClient.invalidateQueries({ queryKey: ["liz_global_status"] });
      setIsGlobalConfirmOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao alternar modo.");
    },
  });

  // Fetch learnings query
  const { data: learnings = [], isLoading: isLoadingLearnings } = useQuery({
    queryKey: ["liz_learnings"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/public/liz-training");
        if (res.ok) {
          const json = await res.json();
          if (json.learnings) return json.learnings as LizLearningItem[];
        }
      } catch (err) {
        console.warn("[liz-training fetch fallback]", err);
      }

      const { data, error } = await supabase
        .from("liz_aprendizados")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[liz_aprendizados error]", error);
        return [];
      }
      return (data || []) as LizLearningItem[];
    },
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (chatMessages: Array<{ role: "user" | "assistant"; content: string }>) => {
      const res = await fetch("/api/public/liz-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          messages: chatMessages,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro no servidor (${res.status})`);
      }

      return (await res.json()) as { reply: string; savedLearning?: LizLearningItem | null };
    },
    onSuccess: (res) => {
      const assistantMsg: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: res.reply,
        savedLearning: res.savedLearning,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (res.savedLearning) {
        toast.success(`✨ Nova regra gravada: "${res.savedLearning.titulo}"`);
        queryClient.invalidateQueries({ queryKey: ["liz_learnings"] });
        queryClient.invalidateQueries({ queryKey: ["liz_neural_logs"] });
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Não foi possível enviar a mensagem.");
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          role: "assistant",
          content: `⚠️ Ocorreu um erro ao processar seu ensinamento: ${err.message || "Tente novamente em instantes."}`,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    },
  });

  // Manual save mutation
  const saveMutation = useMutation({
    mutationFn: async (item: { categoria: string; titulo: string; conteudo: string }) => {
      const res = await fetch("/api/public/liz-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          ...item,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Erro ao salvar regra");
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success("Regra salva na memória da LIZ com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["liz_learnings"] });
      queryClient.invalidateQueries({ queryKey: ["liz_neural_logs"] });
      setIsManualModalOpen(false);
      setManualTitle("");
      setManualContent("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao salvar regra manual.");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/public/liz-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          id,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Erro ao excluir regra");
      }

      return await res.json();
    },
    onSuccess: () => {
      toast.success("Regra removida da memória da LIZ.");
      queryClient.invalidateQueries({ queryKey: ["liz_learnings"] });
      queryClient.invalidateQueries({ queryKey: ["liz_neural_logs"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir regra.");
    },
  });

  // Execução Progressiva em Tempo Real do Disparo
  const handleStartBroadcast = async () => {
    const phones = broadcastPhonesText
      .split(/\n|,|;/)
      .map((p) => p.trim())
      .filter((p) => p.replace(/\D/g, "").length >= 8);

    if (phones.length === 0) {
      toast.error("Insira pelo menos um número de telefone válido.");
      return;
    }

    if (!broadcastMessage.trim()) {
      toast.error("Insira a mensagem para disparo.");
      return;
    }

    abortBroadcastRef.current = false;
    setBroadcastProgress({
      running: true,
      total: phones.length,
      current: 0,
      sent: 0,
      failed: 0,
      logs: [],
    });

    toast.info(`🚀 Iniciando disparo em tempo real para ${phones.length} números com delay de ${broadcastDelay}s...`);

    let sentCount = 0;
    let failedCount = 0;
    const accumulatedLogs: Array<{ phone: string; formattedPhone?: string; status: "sent" | "failed"; messageId?: string | null; error?: string }> = [];

    for (let i = 0; i < phones.length; i++) {
      if (abortBroadcastRef.current) {
        toast.warning("Disparo cancelado pelo usuário.");
        break;
      }

      const phone = phones[i];
      setBroadcastProgress((prev) => ({
        ...prev,
        current: i + 1,
        currentPhone: phone,
      }));

      try {
        const res = await fetch("/api/public/whatsapp/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            message: broadcastMessage,
          }),
        });

        const json = await res.json().catch(() => ({}));
        const singleRes = json.results?.[0];

        if (res.ok && singleRes?.status === "sent") {
          sentCount++;
          accumulatedLogs.unshift({
            phone,
            formattedPhone: singleRes.formattedPhone,
            status: "sent",
            messageId: singleRes.messageId,
          });
        } else {
          failedCount++;
          accumulatedLogs.unshift({
            phone,
            formattedPhone: singleRes?.formattedPhone || phone,
            status: "failed",
            error: singleRes?.error || json.error || `Erro HTTP ${res.status}`,
          });
        }
      } catch (err: any) {
        failedCount++;
        accumulatedLogs.unshift({
          phone,
          status: "failed",
          error: err.message || "Erro de rede",
        });
      }

      setBroadcastProgress((prev) => ({
        ...prev,
        sent: sentCount,
        failed: failedCount,
        logs: [...accumulatedLogs],
      }));

      // Delay seguro entre envios
      if (i < phones.length - 1 && broadcastDelay > 0 && !abortBroadcastRef.current) {
        await new Promise((r) => setTimeout(r, broadcastDelay * 1000));
      }
    }

    setBroadcastProgress((prev) => ({
      ...prev,
      running: false,
      currentPhone: undefined,
    }));

    if (!abortBroadcastRef.current) {
      toast.success(
        `🎉 Disparo finalizado: ${sentCount} enviados com sucesso e ${failedCount} falhas!`,
        { duration: 6000 }
      );
    }
    queryClient.invalidateQueries({ queryKey: ["liz_neural_logs"] });
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || chatMutation.isPending) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage("");

    const payload = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    chatMutation.mutate(payload);
  };

  const filteredLearnings = learnings.filter((l) => {
    const matchesSearch =
      !searchFilter ||
      l.titulo.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.conteudo.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesCategory = categoryFilter === "todos" || l.categoria === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const isGlobalActive = Boolean(lizStatus?.isGlobalEnabled);
  const totalPhonesCount = broadcastPhonesText
    .split(/\n|,|;/)
    .map((p) => p.trim())
    .filter((p) => p.replace(/\D/g, "").length >= 8).length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-950 text-slate-100">
      {/* Top Banner */}
      <div className="border-b border-slate-800 bg-slate-900/90 px-6 py-3.5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* LIZ Info */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-400 text-slate-950 shadow-lg shadow-amber-500/20">
              <Brain className="h-6 w-6" />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-900 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white">Treine a LIZ & Aprendizado Contínuo</h1>
                {isGlobalActive ? (
                  <Badge className="bg-emerald-500/20 border-emerald-500/40 text-emerald-400 text-xs font-semibold gap-1">
                    <Zap className="h-3 w-3" /> Modo Geral Ativo (Todos os Chats)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-semibold gap-1">
                    <Radio className="h-3 w-3 animate-pulse text-amber-400" /> Modo Esponja: Aprendendo com Atendentes
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">
                A LIZ observa e absorve todas as respostas humanas de hoje no WhatsApp para assumir o atendimento ao fim da tarde.
              </p>
            </div>
          </div>

          {/* Action Buttons & Counters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Modal de Disparo em Massa */}
            <Dialog open={isBroadcastModalOpen} onOpenChange={setIsBroadcastModalOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xs gap-1.5 shadow-md shadow-cyan-600/20"
                >
                  <Megaphone className="h-3.5 w-3.5" /> Disparo em Massa ({totalPhonesCount})
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-white">
                    <Megaphone className="h-5 w-5 text-cyan-400" />
                    Transmissão e Disparo em Massa pelo WhatsApp (Z-API)
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2 text-xs">
                  <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-3 text-blue-200 space-y-1">
                    <div className="flex items-center gap-2 font-bold text-blue-300">
                      <Zap className="h-4 w-4" /> Envio Seguro Anti-Bloqueio em Tempo Real
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      Cada número é formatado no padrão oficial (13 dígitos com o 9 adicional). As mensagens são disparadas uma a uma com confirmação de entrega ao vivo na tela.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-200">
                        Lista de Números de Telefone ({totalPhonesCount} destinatários)
                      </label>
                      <span className="text-[11px] text-slate-400">13 dígitos (55 + DDD + 9 + 8 dígitos)</span>
                    </div>
                    <Textarea
                      rows={5}
                      value={broadcastPhonesText}
                      onChange={(e) => setBroadcastPhonesText(e.target.value)}
                      disabled={broadcastProgress.running}
                      className="mt-1 bg-slate-800 border-slate-700 text-white font-mono text-xs"
                      placeholder="5543999999999\n5543988888888"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-200">Mensagem a Ser Disparada</label>
                    <Textarea
                      rows={7}
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      disabled={broadcastProgress.running}
                      className="mt-1 bg-slate-800 border-slate-700 text-white text-xs leading-relaxed"
                      placeholder="Digite o texto da mensagem..."
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
                    <div>
                      <span className="font-semibold text-white block">Intervalo Seguro entre Envios</span>
                      <span className="text-[11px] text-slate-400">Evita bloqueios de chip pelo algoritmo da Meta</span>
                    </div>
                    <Select
                      value={String(broadcastDelay)}
                      onValueChange={(v) => setBroadcastDelay(Number(v))}
                      disabled={broadcastProgress.running}
                    >
                      <SelectTrigger className="w-36 bg-slate-800 border-slate-700 text-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white text-xs">
                        <SelectItem value="2">2 segundos (Rápido)</SelectItem>
                        <SelectItem value="3">3 segundos (Ideal)</SelectItem>
                        <SelectItem value="5">5 segundos (Seguro)</SelectItem>
                        <SelectItem value="8">8 segundos (Ultra Seguro)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {broadcastProgress.running && (
                    <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-cyan-500/40">
                      <div className="flex items-center justify-between text-xs text-cyan-300 font-mono">
                        <span className="flex items-center gap-1.5 font-bold">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                          Enviando para: {broadcastProgress.currentPhone} ({broadcastProgress.current}/{broadcastProgress.total})
                        </span>
                        <span>{Math.round((broadcastProgress.current / broadcastProgress.total) * 100)}%</span>
                      </div>
                      <Progress value={(broadcastProgress.current / broadcastProgress.total) * 100} className="h-2 bg-slate-800" />
                    </div>
                  )}

                  {broadcastProgress.logs.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">Progresso dos Envios:</span>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px]">
                            {broadcastProgress.sent} Enviados com Sucesso
                          </Badge>
                          {broadcastProgress.failed > 0 && (
                            <Badge className="bg-rose-950 text-rose-300 border-rose-500/40 text-[10px]">
                              {broadcastProgress.failed} Falhas
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px]">
                        {broadcastProgress.logs.map((l, idx) => (
                          <div key={idx} className="flex items-center justify-between text-slate-300 py-1 px-2 rounded bg-slate-900/60 border border-slate-800/80">
                            <span className="font-semibold">{l.formattedPhone || l.phone}</span>
                            {l.status === "sent" ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Entregue Z-API
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1" title={l.error}>
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {l.error?.slice(0, 35) || "Falha"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    {broadcastProgress.running ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          abortBroadcastRef.current = true;
                        }}
                        className="gap-1.5 text-xs font-bold"
                      >
                        <StopCircle className="h-3.5 w-3.5" /> Cancelar Disparo
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsBroadcastModalOpen(false)}
                      >
                        Fechar
                      </Button>
                    )}

                    {!broadcastProgress.running && (
                      <Button
                        size="sm"
                        onClick={handleStartBroadcast}
                        disabled={totalPhonesCount === 0 || !broadcastMessage.trim()}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold gap-1.5 shadow-md shadow-cyan-600/20"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Iniciar Disparo para {totalPhonesCount} Contatos
                      </Button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              onClick={() => syncTodayMutation.mutate()}
              disabled={syncTodayMutation.isPending}
              className="border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 text-xs font-medium gap-1.5"
              title="Analisa e sincroniza todas as conversas que os atendentes humanos tiveram hoje"
            >
              {syncTodayMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sincronizar de Hoje
            </Button>

            <Dialog open={isGlobalConfirmOpen} onOpenChange={setIsGlobalConfirmOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className={`font-semibold text-xs gap-1.5 shadow-md ${
                    isGlobalActive
                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  {isGlobalActive ? "Pausar Modo Geral" : "Ativar LIZ para Todos os Chats"}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-white">
                    {isGlobalActive ? "Pausar Atendimento Geral da LIZ" : "🚀 Ativar LIZ para Todos os Chats no WhatsApp?"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2 text-xs text-slate-300 leading-relaxed">
                  {isGlobalActive ? (
                    <p>
                      Deseja retornar o atendimento para o modo humano? A LIZ voltará a responder apenas nas conversas individuais marcadas como piloto.
                    </p>
                  ) : (
                    <>
                      <p>
                        Ao ativar o <b>Modo Geral</b>, a LIZ passará a responder automaticamente <b>todas as conversas abertas e novos leads</b> que chegarem no WhatsApp da LZ7 Energia!
                      </p>
                      <p className="text-amber-300 bg-amber-950/40 border border-amber-500/30 p-2.5 rounded-lg">
                        💡 <b>Recomendado para o fim da tarde:</b> A LIZ utilizará todas as {learnings.length} regras e aprendizados absorvidos com a equipe durante o dia para atender os clientes com tom humano e consultivo.
                      </p>
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <Button variant="ghost" size="sm" onClick={() => setIsGlobalConfirmOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => toggleGlobalMutation.mutate(!isGlobalActive)}
                    disabled={toggleGlobalMutation.isPending}
                    className={`font-semibold ${
                      isGlobalActive ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    {toggleGlobalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isGlobalActive ? (
                      "Confirmar Pausa"
                    ) : (
                      "Sim, Ativar Agora"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold gap-1.5 shadow-md shadow-amber-500/20 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Nova Regra
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-white">
                    <BookOpen className="h-5 w-5 text-amber-400" /> Nova Regra para a Memória da LIZ
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Título da Regra</label>
                    <Input
                      placeholder="Ex: Carência de 120 dias no Santander"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Categoria</label>
                    <Select value={manualCategory} onValueChange={setManualCategory}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="argumento">Argumento de Venda</SelectItem>
                        <SelectItem value="objecao">Quebra de Objeção</SelectItem>
                        <SelectItem value="dado_tecnico">Dado Técnico</SelectItem>
                        <SelectItem value="tarifa">Tarifa / Financiamento</SelectItem>
                        <SelectItem value="regiao">Região / Cidade</SelectItem>
                        <SelectItem value="dica_venda">Dica de Fechamento</SelectItem>
                        <SelectItem value="tom_de_voz">Tom de Voz / Postura</SelectItem>
                        <SelectItem value="geral">Geral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Como a LIZ deve agir / responder no WhatsApp</label>
                    <Textarea
                      placeholder="Descreva com clareza o que a LIZ deve responder quando o cliente tocar nesse assunto..."
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      rows={4}
                      className="bg-slate-800 border-slate-700 text-white mt-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setIsManualModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={() =>
                        saveMutation.mutate({
                          categoria: manualCategory,
                          titulo: manualTitle,
                          conteudo: manualContent,
                        })
                      }
                      disabled={!manualTitle.trim() || !manualContent.trim() || saveMutation.isPending}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
                    >
                      {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar na Memória"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Mode Sub-Navigation Tabs */}
      <div className="flex items-center justify-between px-6 py-2 bg-slate-900/60 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("treino")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "treino"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            <span>Chat de Treinamento</span>
          </button>

          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold font-mono transition ${
              activeTab === "terminal"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                : "text-slate-400 hover:text-emerald-300 hover:bg-slate-800"
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <span>Terminal Hacker de Logs (Ao Vivo)</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab("memoria")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "memoria"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Banco de Memória ({learnings.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/lizlogs" target="_blank" rel="noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="h-7 border-emerald-500/30 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-950/60 text-[11px] font-mono gap-1"
            >
              <ExternalLink className="h-3 w-3" /> /lizlogs tela cheia
            </Button>
          </Link>
        </div>
      </div>

      {/* Tab 1: Treinamento (Split View) */}
      {activeTab === "treino" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Side: Interactive Training Chat (7 cols) */}
          <div className="lg:col-span-7 flex flex-col border-r border-slate-800 bg-slate-950 h-full overflow-hidden">
            {/* Preset Chips Bar */}
            <div className="flex items-center gap-2 overflow-x-auto p-3 border-b border-slate-800/80 bg-slate-900/40 no-scrollbar">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0 px-1">
                <Sparkles className="h-3 w-3 text-amber-400" /> Sugestões de Treino:
              </span>
              {PRESET_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(p.prompt)}
                  disabled={chatMutation.isPending}
                  className="shrink-0 rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-amber-400/50 hover:bg-slate-700 hover:text-white"
                >
                  {p.title}
                </button>
              ))}
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 max-w-3xl ${m.role === "user" ? "ml-auto justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-emerald-400 text-slate-950 shadow">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div className="flex flex-col gap-1 max-w-[85%]">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-medium text-slate-300">
                        {m.role === "user" ? "Você (Stephany / SDR)" : "LIZ (IA)"}
                      </span>
                      <span>• {m.timestamp}</span>
                    </div>

                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                        m.role === "user"
                          ? "bg-amber-500 text-slate-950 font-medium rounded-tr-none"
                          : "bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none"
                      }`}
                    >
                      {m.content}
                    </div>

                    {m.savedLearning && (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-2.5 text-xs text-emerald-300 mt-1 shadow-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-bold text-emerald-300">Regra gravada na memória:</span>{" "}
                          <span className="text-white font-medium">"${m.savedLearning.titulo}"</span> (Categoria:{" "}
                          {m.savedLearning.categoria})
                        </div>
                      </div>
                    )}
                  </div>

                  {m.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-slate-950 shadow">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex gap-3 max-w-3xl justify-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-emerald-400 text-slate-950 shadow animate-pulse">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-slate-400 rounded-tl-none flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                    A LIZ está processando e gravando seu ensinamento...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/60">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-end gap-2"
              >
                <Textarea
                  placeholder="Ensine a LIZ: 'Liz, quando o cliente perguntar X, responda Y...' (Enter para enviar)"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={2}
                  className="bg-slate-800/90 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-400 resize-none rounded-xl"
                />
                <Button
                  type="submit"
                  disabled={!inputMessage.trim() || chatMutation.isPending}
                  className="h-12 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shrink-0 shadow-lg shadow-amber-500/20"
                >
                  {chatMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </form>
            </div>
          </div>

          {/* Right Side: Active Memory Rules (5 cols) */}
          <div className="lg:col-span-5 flex flex-col bg-slate-900/50 h-full overflow-hidden">
            {/* Memory Header & Filters */}
            <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-amber-400" />
                  <h2 className="font-bold text-white text-sm">Memória Ativa da LIZ</h2>
                </div>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-semibold">
                  {learnings.length} regras ativas
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    placeholder="Buscar regras aprendidas..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-8 pl-8 bg-slate-800 border-slate-700 text-xs text-white"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 w-32 bg-slate-800 border-slate-700 text-xs text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white text-xs">
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="argumento">Argumento</SelectItem>
                    <SelectItem value="objecao">Objeção</SelectItem>
                    <SelectItem value="dado_tecnico">Técnico</SelectItem>
                    <SelectItem value="tarifa">Tarifa</SelectItem>
                    <SelectItem value="regiao">Região</SelectItem>
                    <SelectItem value="dica_venda">Dica Venda</SelectItem>
                    <SelectItem value="tom_de_voz">Tom Voz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rules List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingLearnings ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  Carregando memória da LIZ...
                </div>
              ) : filteredLearnings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 p-4 rounded-xl border border-dashed border-slate-800">
                  <Brain className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-xs font-medium text-slate-400">Nenhuma regra encontrada.</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                    Converse com a LIZ no chat ao lado ou adicione uma regra manual para ensiná-la!
                  </p>
                </div>
              ) : (
                filteredLearnings.map((item) => (
                  <div
                    key={item.id}
                    className="group rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 transition hover:border-slate-700 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 border capitalize ${
                              CATEGORY_COLORS[item.categoria] || CATEGORY_COLORS.geral
                            }`}
                          >
                            {item.categoria.replace("_", " ")}
                          </Badge>
                          <h3 className="text-xs font-bold text-white leading-tight">{item.titulo}</h3>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed pt-1 whitespace-pre-wrap">
                          {item.conteudo}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm(`Deseja apagar a regra "${item.titulo}"?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition"
                        title="Excluir regra"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 mt-2 border-t border-slate-800/60">
                      <span>Origem: {item.contexto || "Treinamento SDR"}</span>
                      <span>{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Live Hacker Terminal */}
      {activeTab === "terminal" && (
        <div className="flex-1 p-4 overflow-hidden bg-[#030712]">
          <LizHackerTerminal />
        </div>
      )}

      {/* Tab 3: Banco de Memória Expandido */}
      {activeTab === "memoria" && (
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-amber-400" />
                  Banco de Memória Neural e Regras Comerciais da LIZ
                </h2>
                <p className="text-xs text-slate-400">
                  Todas as instruções, argumentos e quebras de objeção que a LIZ consulta ativamente durante atendimentos.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    placeholder="Filtrar por texto..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-9 pl-8 bg-slate-800 border-slate-700 text-xs text-white"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9 w-40 bg-slate-800 border-slate-700 text-xs text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white text-xs">
                    <SelectItem value="todos">Todas Categorias</SelectItem>
                    <SelectItem value="argumento">Argumento</SelectItem>
                    <SelectItem value="objecao">Objeção</SelectItem>
                    <SelectItem value="dado_tecnico">Técnico</SelectItem>
                    <SelectItem value="tarifa">Tarifa</SelectItem>
                    <SelectItem value="regiao">Região</SelectItem>
                    <SelectItem value="dica_venda">Dica Venda</SelectItem>
                    <SelectItem value="tom_de_voz">Tom Voz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLearnings.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3 flex flex-col justify-between hover:border-slate-700 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 border capitalize ${
                          CATEGORY_COLORS[item.categoria] || CATEGORY_COLORS.geral
                        }`}
                      >
                        {item.categoria.replace("_", " ")}
                      </Badge>
                      <button
                        onClick={() => {
                          if (confirm(`Deseja apagar a regra "${item.titulo}"?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        className="p-1 text-slate-500 hover:text-red-400 transition"
                        title="Excluir regra"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-white">{item.titulo}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {item.conteudo}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-800/80">
                    <span>Origem: {item.contexto || "Treinamento SDR"}</span>
                    <span>{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
