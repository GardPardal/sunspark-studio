// Fila local de leads capturados offline pelo consultor.
// Persistida em localStorage — funciona no APK Capacitor mesmo sem torre.
// É esvaziada automaticamente quando o navegador volta online.

export type QueuedLead = {
  id: string; // uuid local
  createdAt: number;
  attempts: number;
  lastError?: string | null;
  payload: {
    nome: string;
    telefone: string;
    email: string | null;
    cidade: string | null;
    estado: string | null;
    valor_conta: string | null;
    origem: string;
    produto_interesse: string | null;
    captacao_metodo: string | null;
    mensagem: string | null;
  };
};

const KEY = "lz7:offline_leads_v1";
const EVT = "lz7:offline-queue-changed";

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readQueue(): QueuedLead[] {
  const ls = safeStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedLead[]) {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(KEY, JSON.stringify(items));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {}
}

export function enqueueLead(payload: QueuedLead["payload"]): QueuedLead {
  const item: QueuedLead = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: Date.now(),
    attempts: 0,
    payload,
  };
  const q = readQueue();
  q.push(item);
  writeQueue(q);
  return item;
}

export function removeQueued(id: string) {
  writeQueue(readQueue().filter((i) => i.id !== id));
}

export function updateQueued(id: string, patch: Partial<QueuedLead>) {
  writeQueue(readQueue().map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

export function subscribeQueue(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
  };
}

/** True se o navegador acredita que está offline. Não temos como garantir 100%,
 *  mas é um bom sinal para escolher o caminho de fallback. */
export function isOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}
