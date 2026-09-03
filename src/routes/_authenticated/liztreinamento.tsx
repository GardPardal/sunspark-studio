import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

function LizTrainingPage() {
  const queryClient = useQueryClient();

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

  // Manual rule state
  const [manualTitle, setManualTitle] = useState("");
  const [manualCategory, setManualCategory] = useState("argumento");
  const [manualContent, setManualContent] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch learnings query (usando API endpoint dedicado + fallback Supabase direto)
  const { data: learnings = [], isLoading: isLoadingLearnings, refetch: refetchLearnings } = useQuery({
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

      // Fallback Supabase client
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
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao excluir regra.");
    },
  });

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

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-400 text-slate-950 shadow-lg shadow-amber-500/20">
            <Brain className="h-6 w-6" />
            <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-900" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">Treine a LIZ</h1>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                ⚡ Ao Vivo no WhatsApp
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Converse com a LIZ para ensinar argumentos e regras de atendimento. Tudo que ela aprender aqui é aplicado imediatamente nos clientes reais.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchLearnings()}
            className="text-slate-400 hover:text-white"
            title="Atualizar lista de regras"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold gap-1.5 shadow-md shadow-amber-500/20">
                <Plus className="h-4 w-4" /> Adicionar Regra Manual
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

      {/* Main Container: Split 2 Columns */}
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
                        <span className="text-white font-medium">"{m.savedLearning.titulo}"</span> (Categoria:{" "}
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
    </div>
  );
}