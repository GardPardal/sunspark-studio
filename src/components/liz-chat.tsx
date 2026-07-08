import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Sparkles, Sun } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getPersistedAttribution } from "@/lib/tracking";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

type Props = {
  mode?: "capture" | "internal";
  /** Se true renderiza inline (sem botão flutuante). Útil na página de captura. */
  inline?: boolean;
  greeting?: string;
  triggerLabel?: string;
  className?: string;
};

const CAPTURE_GREETING =
  "Oi! Eu sou a **LIZ**, da LZ7 Energia ☀️\nVou te ajudar a descobrir quanto você pode economizar na conta de luz. Pra começar, qual seu nome?";

const INTERNAL_GREETING =
  "Oi, time! Eu sou a **LIZ**. Posso te ajudar a preparar abordagem, quebrar objeção, escrever mensagem, pesquisar tarifa, revisar proposta… manda a real. 😊";

export function LizChat({
  mode = "capture",
  inline = false,
  greeting,
  triggerLabel,
  className,
}: Props) {
  const initialGreeting: Msg = {
    role: "assistant",
    content: greeting ?? (mode === "internal" ? INTERNAL_GREETING : CAPTURE_GREETING),
  };
  const [open, setOpen] = useState(inline);
  const [messages, setMessages] = useState<Msg[]>([initialGreeting]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [qualified, setQualified] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const attribution = mode === "capture" ? getPersistedAttribution() : undefined;
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (mode === "internal") {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) headers["authorization"] = `Bearer ${token}`;
      }
      const res = await fetch("/api/public/liz-chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: next, attribution, mode }),
      });
      const data = (await res.json()) as { reply?: string; error?: string; qualified?: boolean };
      if (data.error) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "…" }]);
      if (data.qualified) setQualified(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ops, deu um problema aqui.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            mode === "capture"
              ? `⚠️ ${msg}\nTenta de novo daqui a pouco ou fala com a gente no WhatsApp.`
              : `⚠️ ${msg}\nTenta de novo daqui a pouco.`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const HeaderIcon = mode === "internal" ? Sparkles : Sun;
  const headerSub =
    mode === "internal"
      ? qualified
        ? "Lead salvo ✓"
        : "Assistente do time"
      : qualified
        ? "Lead registrado ✓"
        : "Online agora";

  const chatCard = (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl",
        inline
          ? "h-[min(78dvh,720px)] w-full"
          : "fixed bottom-5 right-5 z-50 h-[600px] max-h-[85vh] w-[calc(100vw-2.5rem)] max-w-[380px]",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary to-primary/80 px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <HeaderIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">LIZ · LZ7 Energia</p>
            <p className="text-[11px] leading-tight opacity-90">{headerSub}</p>
          </div>
        </div>
        {!inline && (
          <button
            type="button"
            aria-label="Fechar chat"
            onClick={() => setOpen(false)}
            className="rounded-full p-1 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-background text-foreground shadow-sm"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none [&_p]:my-1 [&_strong]:text-foreground">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-border bg-background p-3"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={mode === "internal" ? "Peça algo à Liz…" : "Digite sua mensagem…"}
          disabled={sending}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary disabled:opacity-60 sm:text-sm"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Enviar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );

  if (inline) return chatCard;

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label={triggerLabel ?? "Falar com a LIZ"}
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-105"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden text-sm font-semibold sm:inline">
            {triggerLabel ?? "Fale com a LIZ"}
          </span>
        </button>
      )}
      {open && chatCard}
    </>
  );
}
