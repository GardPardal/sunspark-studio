import { useEffect, useMemo, useRef, useState } from "react";
import { NotebookPen, Plus, Trash2, X, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  text: string;
  color: "amber" | "emerald" | "sky" | "rose";
  updated_at: string;
};

const STORAGE_KEY = "lz7_floating_notes_v1";

const COLORS: Record<Note["color"], string> = {
  amber:
    "bg-amber-100 text-amber-950 border-amber-300/70 dark:bg-amber-500/15 dark:text-amber-50 dark:border-amber-500/30",
  emerald:
    "bg-emerald-100 text-emerald-950 border-emerald-300/70 dark:bg-emerald-500/15 dark:text-emerald-50 dark:border-emerald-500/30",
  sky: "bg-sky-100 text-sky-950 border-sky-300/70 dark:bg-sky-500/15 dark:text-sky-50 dark:border-sky-500/30",
  rose: "bg-rose-100 text-rose-950 border-rose-300/70 dark:bg-rose-500/15 dark:text-rose-50 dark:border-rose-500/30",
};

const CYCLE: Note["color"][] = ["amber", "emerald", "sky", "rose"];

function load(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function FloatingNotes() {
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const firstRun = useRef(true);

  useEffect(() => {
    setNotes(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
      /* quota cheia — ignora */
    }
  }, [notes, hydrated]);

  const filled = useMemo(() => notes.filter((n) => n.text.trim().length > 0).length, [notes]);

  const addNote = () =>
    setNotes((prev) => [
      {
        id: crypto.randomUUID(),
        text: "",
        color: CYCLE[prev.length % CYCLE.length],
        updated_at: new Date().toISOString(),
      },
      ...prev,
    ]);

  const updateNote = (id: string, text: string) =>
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, text, updated_at: new Date().toISOString() } : n)),
    );

  const removeNote = (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id));

  if (!hydrated) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir bloco de anotações"
          className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] left-4 z-40 flex h-12 items-center gap-2 rounded-full border bg-background/95 px-4 text-sm font-semibold shadow-lg backdrop-blur transition hover:shadow-xl lg:bottom-6"
        >
          <NotebookPen className="h-4 w-4 text-primary" />
          Anotações
          {filled > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {filled}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-3 right-3 z-40 max-h-[70vh] w-auto overflow-hidden rounded-2xl border bg-background/95 shadow-2xl backdrop-blur sm:right-auto sm:w-[360px] lg:bottom-6">
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-semibold">Bloco de anotações</div>
              <div className="text-[11px] text-muted-foreground">
                Salvo automaticamente neste dispositivo
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={addNote} aria-label="Nova anotação">
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[calc(70vh-52px)] space-y-2.5 overflow-y-auto p-3">
            {notes.length === 0 && (
              <button
                type="button"
                onClick={addNote}
                className="w-full rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground transition hover:bg-muted/40"
              >
                Nenhuma anotação ainda. Toque para criar a primeira.
              </button>
            )}

            {notes.map((n) => (
              <div key={n.id} className={cn("rounded-xl border p-2.5 shadow-sm", COLORS[n.color])}>
                <textarea
                  value={n.text}
                  onChange={(e) => updateNote(n.id, e.target.value)}
                  placeholder="Escreva aqui…"
                  rows={3}
                  className="w-full resize-y bg-transparent text-sm leading-relaxed outline-none placeholder:text-current/50"
                />
                <div className="mt-1 flex items-center justify-between text-[10px] opacity-70">
                  <span>
                    {new Date(n.updated_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNote(n.id)}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:bg-black/10"
                    aria-label="Excluir anotação"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
