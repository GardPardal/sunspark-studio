import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Download, ExternalLink, Sun } from "lucide-react";
import { DEFAULT_SETTINGS, useSiteSettings } from "@/lib/site-settings";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel — LZ7 Energia" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Sun className="h-5 w-5" /> LZ7 Energia · Painel
          </Link>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/"><ExternalLink className="h-4 w-4 mr-2" /> Ver site</Link>
            </Button>
            <Button onClick={signOut} variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Tabs defaultValue="leads">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="leads" className="mt-6">
            <LeadsPanel />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* --------------------------------- Leads ---------------------------------- */

function LeadsPanel() {
  const [search, setSearch] = useState("");
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["admin_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = leads.filter((l) =>
    !search || `${l.nome} ${l.telefone} ${l.email ?? ""} ${l.cidade ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ["Data", "Nome", "Telefone", "Email", "Cidade", "Estado", "Valor Conta", "Origem", "UTM Source", "UTM Medium", "UTM Campaign", "GCLID", "FBCLID", "Página", "Mensagem"];
    const rows = filtered.map((l) => [
      new Date(l.created_at).toLocaleString("pt-BR"),
      l.nome, l.telefone, l.email ?? "", l.cidade ?? "", l.estado ?? "", l.valor_conta ?? "",
      l.origem ?? "", l.utm_source ?? "", l.utm_medium ?? "", l.utm_campaign ?? "",
      l.gclid ?? "", l.fbclid ?? "", l.page_url ?? "",
      (l.mensagem ?? "").replace(/\n/g, " "),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-lz7-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Leads capturados</h2>
          <p className="text-sm text-muted-foreground">{leads.length} no total</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Button onClick={exportCSV} variant="outline"><Download className="h-4 w-4 mr-2" /> Exportar CSV</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Conta</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lead ainda.</TableCell></TableRow>
            )}
            {filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="font-medium">{l.nome}</TableCell>
                <TableCell>
                  <a className="text-primary hover:underline" href={`https://wa.me/${l.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                    {l.telefone}
                  </a>
                </TableCell>
                <TableCell>{[l.cidade, l.estado].filter(Boolean).join(" / ")}</TableCell>
                <TableCell>{l.valor_conta}</TableCell>
                <TableCell className="text-sm">{l.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* -------------------------------- Settings -------------------------------- */

const FIELDS: { key: keyof typeof DEFAULT_SETTINGS; label: string; textarea?: boolean; help?: string }[] = [
  { key: "whatsapp", label: "WhatsApp (só números, com DDI)", help: "Ex: 5543996172509" },
  { key: "phone", label: "Telefone (exibido)" },
  { key: "email", label: "E-mail de contato" },
  { key: "instagram", label: "URL do Instagram" },
  { key: "video_url", label: "URL do vídeo do YouTube (hero)", help: "Cole a URL padrão ou de embed" },
  { key: "hero_title", label: "Título principal (Hero)", textarea: true },
  { key: "hero_subtitle", label: "Subtítulo do Hero", textarea: true },
  { key: "ga4_measurement_id", label: "Google Analytics 4 (Measurement ID)", help: "Ex: G-XXXXXXXXXX" },
  { key: "google_ads_id", label: "Google Ads (Conversion ID)", help: "Ex: AW-123456789" },
  { key: "google_ads_conversion_label", label: "Google Ads (Conversion Label)", help: "Etiqueta da conversão de lead. Ex: abcDEFghiJKL" },
  { key: "meta_pixel_id", label: "Meta Pixel (Facebook/Instagram)", help: "Ex: 1234567890123456" },
];

function SettingsPanel() {
  const { data: settings = DEFAULT_SETTINGS } = useSiteSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const value = (k: string) => form[k] ?? settings[k] ?? "";

  const save = useMutation({
    mutationFn: async () => {
      const rows = FIELDS.map((f) => ({ key: f.key, value: value(f.key), updated_at: new Date().toISOString() }));
      const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site_settings"] });
      setForm({});
      toast.success("Configurações salvas!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-1">Configurações do site</h2>
      <p className="text-sm text-muted-foreground mb-6">Alterações aparecem no site imediatamente.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.textarea ? "md:col-span-2" : ""}>
            <Label htmlFor={f.key}>{f.label}</Label>
            {f.textarea ? (
              <Textarea id={f.key} rows={2} value={value(f.key)}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className="mt-1.5" />
            ) : (
              <Input id={f.key} value={value(f.key)}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className="mt-1.5" />
            )}
            {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </Card>
  );
}
