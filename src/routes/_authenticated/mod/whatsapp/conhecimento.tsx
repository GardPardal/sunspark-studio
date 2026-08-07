import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, RefreshCw, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteKbDocument,
  listKbDocuments,
  reindexKbDocument,
  saveKbDocument,
  testKbRetrieval,
} from "@/lib/kb.functions";
import { getMyOrg } from "@/lib/wa-inbox.functions";

export const Route = createFileRoute("/_authenticated/mod/whatsapp/conhecimento")({
  head: () => ({
    meta: [
      { title: "Base de conhecimento da IA | Solar OS" },
      {
        name: "description",
        content:
          "Cadastre respostas, produtos e políticas que a IA do WhatsApp usa para atender clientes.",
      },
      { property: "og:title", content: "Base de conhecimento da IA | Solar OS" },
      {
        property: "og:description",
        content: "Documentos indexados por significado para respostas fiéis ao seu negócio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const orgFn = useServerFn(getMyOrg);
  const listFn = useServerFn(listKbDocuments);
  const saveFn = useServerFn(saveKbDocument);
  const delFn = useServerFn(deleteKbDocument);
  const reindexFn = useServerFn(reindexKbDocument);
  const testFn = useServerFn(testKbRetrieval);
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [query, setQuery] = useState("");

  const org = useQuery({ queryKey: ["my-org"], queryFn: () => orgFn({}) });
  const orgId = org.data?.id;

  const docs = useQuery({
    queryKey: ["kb-docs", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: editingId,
          orgId: orgId!,
          title: title.trim(),
          content: content.trim(),
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (r) => {
      toast.success(`Documento indexado em ${r.chunks} trechos`);
      setTitle("");
      setContent("");
      setTags("");
      setEditingId(undefined);
      qc.invalidateQueries({ queryKey: ["kb-docs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb-docs"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reindex = useMutation({
    mutationFn: (id: string) => reindexFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Reindexado");
      qc.invalidateQueries({ queryKey: ["kb-docs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: { orgId: orgId!, query: query.trim() } }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Base de conhecimento</h1>
        <p className="text-sm text-muted-foreground">
          Tudo que você escrever aqui vira material de consulta da IA no WhatsApp.
        </p>
      </header>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="kb-title">Título</Label>
            <Input
              id="kb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Como funciona o financiamento solar"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kb-tags">Tags (separadas por vírgula)</Label>
            <Input
              id="kb-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="financiamento, objeções"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="kb-content">Conteúdo</Label>
          <Textarea
            id="kb-content"
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva em texto corrido, como você explicaria para um cliente."
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !title || !content}>
            <BookOpen className="mr-2 h-4 w-4" />
            {editingId ? "Atualizar e reindexar" : "Salvar e indexar"}
          </Button>
          {editingId ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(undefined);
                setTitle("");
                setContent("");
                setTags("");
              }}
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <Label htmlFor="kb-test">Testar o que a IA encontraria</Label>
        <div className="flex gap-2">
          <Input
            id="kb-test"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: vocês parcelam em quantas vezes?"
          />
          <Button onClick={() => test.mutate()} disabled={query.trim().length < 3}>
            <Search className="mr-2 h-4 w-4" /> Testar
          </Button>
        </div>
        {test.data?.length ? (
          <div className="space-y-2">
            {test.data.map((h) => (
              <div key={h.id} className="rounded-lg border p-3 text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">{h.title}</span>
                  <Badge variant="secondary">{(h.similarity * 100).toFixed(0)}%</Badge>
                </div>
                <p className="text-muted-foreground">{h.content.slice(0, 320)}…</p>
              </div>
            ))}
          </div>
        ) : test.isSuccess ? (
          <p className="text-sm text-muted-foreground">Nada encontrado para essa pergunta.</p>
        ) : null}
      </Card>

      <div className="space-y-2">
        {docs.data?.map((d) => (
          <Card key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{d.title}</p>
              <p className="text-xs text-muted-foreground">
                {d.chunk_count} trechos · {d.status}
                {d.error ? ` · ${d.error}` : ""}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => reindex.mutate(d.id)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(d.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
