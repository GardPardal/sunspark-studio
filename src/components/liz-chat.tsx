import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Sparkles, Sun, Paperclip, Mic, Square, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getPersistedAttribution } from "@/lib/tracking";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Attachment = {
  kind: "image" | "audio";
  dataUrl: string;
  mime: string;
  name?: string;
};
type Msg = { role: "user" | "assistant"; content: string; attachments?: Attachment[] };

const MAX_ATT_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ATT_COUNT = 5;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const f of list) {
      if (attachments.length >= MAX_ATT_COUNT) break;
      if (f.size > MAX_ATT_BYTES) {
        alert(`"${f.name}" passa de 10MB e não pode ser anexado.`);
        continue;
      }
      const isImg = f.type.startsWith("image/");
      const isAud = f.type.startsWith("audio/");
      if (!isImg && !isAud) {
        alert(`"${f.name}" não é imagem nem áudio.`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(f);
        setAttachments((prev) => [
          ...prev,
          { kind: isImg ? "image" : "audio", dataUrl, mime: f.type, name: f.name },
        ]);
      } catch {
        // ignore
      }
    }
  };

  const removeAttachment = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size > MAX_ATT_BYTES) {
          alert("Áudio muito longo (>10MB). Tente algo mais curto.");
          return;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
        setAttachments((prev) => [
          ...prev,
          { kind: "audio", dataUrl, mime, name: `gravacao-${Date.now()}.${mime.includes("mp4") ? "m4a" : "webm"}` },
        ]);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      alert("Não consegui acessar o microfone. Verifique a permissão.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current && typeof window !== "undefined") {
    const key = `liz_session_${mode}`;
    let sid = window.localStorage.getItem(key);
    if (!sid) {
      sid = `${mode}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      try { window.localStorage.setItem(key, sid); } catch {}
    }
    sessionIdRef.current = sid;
  }

  const send = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || sending) return;
    const userMsg: Msg = {
      role: "user",
      content: text,
      attachments: attachments.length ? attachments : undefined,
    };
    const next: Msg[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setAttachments([]);
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
        body: JSON.stringify({ messages: next, attribution, mode, sessionId: sessionIdRef.current }),
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
          : "fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+160px)] sm:bottom-24 z-50 h-[70vh] max-h-[600px] w-[calc(100vw-2rem)] max-w-[380px]",
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
                <>
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {m.attachments.map((a, ai) =>
                        a.kind === "image" ? (
                          <img
                            key={ai}
                            src={a.dataUrl}
                            alt={a.name ?? "anexo"}
                            className="h-20 w-20 rounded-md object-cover"
                          />
                        ) : (
                          <audio key={ai} controls src={a.dataUrl} className="h-8 max-w-full" />
                        ),
                      )}
                    </div>
                  )}
                  {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                </>
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

      <div className="border-t border-border bg-background">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((a, i) => (
              <div key={i} className="relative">
                {a.kind === "image" ? (
                  <img src={a.dataUrl} alt={a.name} className="h-14 w-14 rounded-md object-cover" />
                ) : (
                  <div className="flex h-14 items-center gap-1 rounded-md border border-border bg-muted px-2 text-xs text-muted-foreground">
                    <Mic className="h-3.5 w-3.5" /> áudio
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  aria-label="Remover anexo"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 p-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            aria-label="Anexar arquivo"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || attachments.length >= MAX_ATT_COUNT}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={recording ? "Parar gravação" : "Gravar áudio"}
            onClick={() => (recording ? stopRecording() : startRecording())}
            disabled={sending || (!recording && attachments.length >= MAX_ATT_COUNT)}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border transition disabled:opacity-50",
              recording
                ? "animate-pulse bg-red-500 text-white"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const files: File[] = [];
              for (const item of e.clipboardData.items) {
                if (item.kind === "file") {
                  const f = item.getAsFile();
                  if (f && (f.type.startsWith("image/") || f.type.startsWith("audio/"))) files.push(f);
                }
              }
              if (files.length) {
                e.preventDefault();
                void addFiles(files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={mode === "internal" ? "Peça algo à Liz… (cole imagem/áudio)" : "Digite, cole ou anexe…"}
            disabled={sending}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary disabled:opacity-60 sm:text-sm"
          />
          <button
            type="submit"
            disabled={sending || (!input.trim() && attachments.length === 0)}
            aria-label="Enviar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
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
          className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+88px)] sm:bottom-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-105"
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
