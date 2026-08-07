import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getMyOrg, listWaChannels, upsertWaChannel } from "@/lib/wa-inbox.functions";

export const Route = createFileRoute("/_authenticated/mod/whatsapp/config")({
  head: () => ({
    meta: [
      { title: "Configuração do WhatsApp | Solar OS" },
      {
        name: "description",
        content:
          "Controle o número do WhatsApp, o modo sombra, a lista de teste e a personalidade da IA.",
      },
      { property: "og:title", content: "Configuração do WhatsApp | Solar OS" },
      {
        property: "og:description",
        content: "Ative a IA com segurança: modo sombra, lista de teste e persona.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsAppConfig,
});

function WhatsAppConfig() {
  const orgFn = useServerFn(getMyOrg);
  const listFn = useServerFn(listWaChannels);
  const saveFn = useServerFn(upsertWaChannel);
  const qc = useQueryClient();

  const org = useQuery({ queryKey: ["my-org"], queryFn: () => orgFn({}) });
  const orgId = org.data?.id;

  const channels = useQuery({
    queryKey: ["wa-channels", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const first = channels.data?.[0];
  const [form, setForm] = useState({
    label: "Canal principal",
    phoneNumberId: "",
    displayPhone: "",
    botEnabled: false,
    shadowMode: true,
    allowlist: "",
    persona: "",
  });

  useEffect(() => {
    if (!first) return;
    setForm({
      label: first.label,
      phoneNumberId: first.phone_number_id,
      displayPhone: first.display_phone ?? "",
      botEnabled: first.bot_enabled,
      shadowMode: first.shadow_mode,
      allowlist: (first.test_allowlist ?? []).join(", "),
      persona: first.persona ?? "",
    });
  }, [first]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: first?.id,
          orgId: orgId!,
          label: form.label.trim(),
          phoneNumberId: form.phoneNumberId.trim(),
          displayPhone: form.displayPhone.trim() || undefined,
          botEnabled: form.botEnabled,
          shadowMode: form.shadowMode,
          testAllowlist: form.allowlist
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          persona: form.persona.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["wa-channels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-24">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Configuração do WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Comece em modo sombra: o sistema grava tudo e não responde ninguém.
        </p>
      </header>

      <Card className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="label">Nome do canal</Label>
            <Input
              id="label"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pnid">ID do número (phone_number_id)</Label>
            <Input
              id="pnid"
              value={form.phoneNumberId}
              onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
              placeholder="1234567890"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="display">Número exibido</Label>
            <Input
              id="display"
              value={form.displayPhone}
              onChange={(e) => setForm({ ...form, displayPhone: e.target.value })}
              placeholder="+55 43 99999-0000"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="allow">Lista de teste (telefones E.164)</Label>
            <Input
              id="allow"
              value={form.allowlist}
              onChange={(e) => setForm({ ...form, allowlist: e.target.value })}
              placeholder="+5543999990000, +5542988880000"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="persona">Personalidade e regras da IA</Label>
          <Textarea
            id="persona"
            rows={6}
            value={form.persona}
            onChange={(e) => setForm({ ...form, persona: e.target.value })}
            placeholder="Ex: Você é a assistente comercial da LZ7 Energia. Mensagens curtas, uma pergunta por vez, nunca prometa preço fechado."
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium">Modo sombra</p>
            <p className="text-xs text-muted-foreground">
              Grava conversas sem responder. Desligue só depois de validar as respostas.
            </p>
          </div>
          <Switch
            checked={form.shadowMode}
            onCheckedChange={(v) => setForm({ ...form, shadowMode: v })}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium">IA respondendo</p>
            <p className="text-xs text-muted-foreground">
              Com a lista de teste preenchida, só esses números recebem resposta automática.
            </p>
          </div>
          <Switch
            checked={form.botEnabled}
            onCheckedChange={(v) => setForm({ ...form, botEnabled: v })}
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Temas sensíveis, pedidos de atendente e baixa confiança da IA vão sempre para uma pessoa.
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending || !form.phoneNumberId}>
          <Save className="mr-2 h-4 w-4" /> Salvar configuração
        </Button>
      </Card>
    </div>
  );
}
