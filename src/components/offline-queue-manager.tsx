import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WifiOff, CloudUpload, CheckCircle2 } from "lucide-react";
import { createOfflineLead } from "@/lib/crm-advanced.functions";
import {
  readQueue,
  removeQueued,
  updateQueued,
  subscribeQueue,
  isOffline,
  type QueuedLead,
} from "@/lib/offline-lead-queue";

/**
 * Escuta o evento `online`, tenta re-enviar leads que ficaram na fila.
 * Também exibe um chip fixo (canto inferior esquerdo) mostrando o estado da conexão
 * e quantos leads estão pendentes de envio.
 */
export function OfflineQueueManager() {
  const qc = useQueryClient();
  const sendFn = useServerFn(createOfflineLead);
  const [queue, setQueue] = useState<QueuedLead[]>([]);
  const [offline, setOffline] = useState<boolean>(false);
  const [flushing, setFlushing] = useState(false);
  const flushingRef = useRef(false);

  const refresh = useCallback(() => setQueue(readQueue()), []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const items = readQueue();
    if (!items.length) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    flushingRef.current = true;
    setFlushing(true);

    let ok = 0;
    let fail = 0;
    for (const item of items) {
      try {
        await sendFn({ data: item.payload });
        removeQueued(item.id);
        ok += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateQueued(item.id, {
          attempts: item.attempts + 1,
          lastError: msg,
        });
        fail += 1;
      }
    }

    flushingRef.current = false;
    setFlushing(false);
    refresh();

    if (ok > 0) {
      toast.success(
        ok === 1
          ? "1 lead offline foi enviado."
          : `${ok} leads offline foram enviados.`,
        { icon: <CheckCircle2 className="h-4 w-4" /> },
      );
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
    }
    if (fail > 0) {
      toast.error(
        fail === 1
          ? "1 lead offline não pôde ser enviado. Tentaremos de novo."
          : `${fail} leads offline não puderam ser enviados. Tentaremos de novo.`,
      );
    }
  }, [qc, refresh, sendFn]);

  useEffect(() => {
    refresh();
    setOffline(isOffline());
    const unsub = subscribeQueue(refresh);
    const onOnline = () => {
      setOffline(false);
      flush();
    };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // tenta esvaziar no mount (caso a rede tenha voltado enquanto o app estava fechado)
    flush();
    // re-tenta periodicamente se sobrou algo pendente
    const interval = window.setInterval(() => {
      if (readQueue().length > 0 && navigator.onLine !== false) flush();
    }, 60_000);
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(interval);
    };
  }, [flush, refresh]);

  const pending = queue.length;
  if (!offline && pending === 0) return null;

  return (
    <div
      className="fixed left-3 z-40"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}
    >
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur ${
          offline
            ? "bg-amber-500/95 text-amber-950"
            : "bg-primary/95 text-primary-foreground"
        }`}
        role="status"
      >
        {offline ? (
          <WifiOff className="h-3.5 w-3.5" />
        ) : (
          <CloudUpload className={`h-3.5 w-3.5 ${flushing ? "animate-pulse" : ""}`} />
        )}
        <span>
          {offline
            ? pending > 0
              ? `Sem conexão · ${pending} lead${pending > 1 ? "s" : ""} na fila`
              : "Sem conexão · cadastros ficam salvos"
            : flushing
              ? `Enviando ${pending} lead${pending > 1 ? "s" : ""}…`
              : `${pending} lead${pending > 1 ? "s" : ""} para enviar`}
        </span>
        {!offline && !flushing && pending > 0 && (
          <button
            type="button"
            onClick={() => flush()}
            className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide hover:bg-white/30"
          >
            Reenviar
          </button>
        )}
      </div>
    </div>
  );
}
