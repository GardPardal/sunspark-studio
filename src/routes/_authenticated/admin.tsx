import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { LogOut, Download, ExternalLink, Sun, UserPlus, Trash2, Kanban, RefreshCw, PlugZap, KeyRound, Palette, Upload, RotateCcw } from "lucide-react";
import { DEFAULT_SETTINGS, useSiteSettings } from "@/lib/site-settings";
import { listUsers, createUser, deleteUser, setUserRole } from "@/lib/admin-users.functions";
import { assignLead, listCrmLeads } from "@/lib/crm.functions";
import { testPloomes, syncPloomesLeads, syncPloomesPipelines } from "@/lib/ploomes.functions";

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
  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Sun className="h-5 w-5" /> LZ7 Energia · Painel
          </Link>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/crm"><Kanban className="h-4 w-4 mr-2" /> CRM</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/"><ExternalLink className="h-4 w-4 mr-2" /> Site</Link>
            </Button>
            <Button onClick={signOut} variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Tabs defaultValue="leads">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="site">Site</TabsTrigger>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            <TabsTrigger value="code">Código</TabsTrigger>
            <TabsTrigger value="tags">Tags & Pixels</TabsTrigger>
            <TabsTrigger value="ploomes">Ploomes</TabsTrigger>
          </TabsList>
          <TabsContent value="leads" className="mt-6"><LeadsPanel /></TabsContent>
          <TabsContent value="users" className="mt-6"><UsersPanel /></TabsContent>
          <TabsContent value="site" className="mt-6"><SettingsPanel fields={SITE_FIELDS} title="Conteúdo do site" /></TabsContent>
          <TabsContent value="appearance" className="mt-6"><AppearancePanel /></TabsContent>
          <TabsContent value="code" className="mt-6"><CodeEditorPanel /></TabsContent>
          <TabsContent value="tags" className="mt-6">
            <SettingsPanel fields={TAG_FIELDS} title="Tags, Pixels & APIs de Conversão" description="IDs públicos ficam aqui. Tokens privados (Meta CAPI, TikTok Events, GA4 Measurement Protocol) devem ser cadastrados como secrets do backend." />
            <SecretsHelp />
          </TabsContent>
          <TabsContent value="ploomes" className="mt-6"><PloomesPanel /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* --------------------------------- Leads ---------------------------------- */

function LeadsPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const listLeadsFn = useServerFn(listCrmLeads);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["admin_leads"],
    queryFn: () => listLeadsFn(),
    refetchOnWindowFocus: true,
  });

  const listUsersFn = useServerFn(listUsers);
  const { data: users = [] } = useQuery({ queryKey: ["admin_users"], queryFn: () => listUsersFn() });
  const consultores = users.filter((u) => u.roles.includes("consultor") || u.roles.includes("admin"));

  const assignFn = useServerFn(assignLead);
  const assignM = useMutation({
    mutationFn: (v: { leadId: string; assignedTo: string | null }) => assignFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_leads"] });
      qc.invalidateQueries({ queryKey: ["crm_leads"] });
      toast.success("Atribuição atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = leads.filter((l: any) =>
    !search || `${l.nome} ${l.telefone} ${l.email ?? ""} ${l.cidade ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ["Data", "Nome", "Telefone", "Email", "Cidade", "Estado", "Estágio", "Valor Venda", "Valor Conta", "Origem", "UTM Source", "UTM Campaign", "GCLID", "FBCLID", "Página"];
    const rows = filtered.map((l: any) => [
      new Date(l.created_at).toLocaleString("pt-BR"),
      l.nome, l.telefone, l.email ?? "", l.cidade ?? "", l.estado ?? "", l.stage ?? "", l.sale_value ?? "", l.valor_conta ?? "",
      l.origem ?? "", l.utm_source ?? "", l.utm_campaign ?? "", l.gclid ?? "", l.fbclid ?? "", l.page_url ?? "",
    ]);
    const csv = [headers, ...rows].map((r: unknown[]) => r.map((v: unknown) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads-lz7-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const stageLabel: Record<string, string> = {
    novo: "Novo", atendimento: "Em atendimento", nao_atendido: "Não atendido",
    venda: "Venda", faturado: "Faturado", perdido: "Perdido",
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
              <TableHead>Estágio</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Venda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lead ainda.</TableCell></TableRow>
            )}
            {filtered.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="font-medium">
                  <div>{l.nome}</div>
                  <div className="text-xs text-muted-foreground">{l.cidade}/{l.estado} · {l.valor_conta}</div>
                </TableCell>
                <TableCell>
                  <a className="text-primary hover:underline" href={`https://wa.me/${l.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                    {l.telefone}
                  </a>
                </TableCell>
                <TableCell><Badge variant="outline">{stageLabel[l.stage] ?? l.stage}</Badge></TableCell>
                <TableCell>
                  <Select
                    value={l.assigned_to ?? "none"}
                    onValueChange={(v) => assignM.mutate({ leadId: l.id, assignedTo: v === "none" ? null : v })}
                  >
                    <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sem responsável —</SelectItem>
                      {consultores.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium">{l.utm_source || l.origem || "—"}</div>
                  {l.gclid && <div className="text-primary">Google Ads</div>}
                  {l.fbclid && <div className="text-primary">Meta Ads</div>}
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {l.sale_value ? Number(l.sale_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* --------------------------------- Users ---------------------------------- */

function UsersPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const createFn = useServerFn(createUser);
  const setRoleFn = useServerFn(setUserRole);
  const delFn = useServerFn(deleteUser);

  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin_users"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", role: "consultor" as "admin" | "consultor" });

  const createM = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_users"] });
      setOpen(false);
      setForm({ email: "", password: "", fullName: "", role: "consultor" });
      toast.success("Usuário criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleM = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "consultor" }) => setRoleFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_users"] }); toast.success("Perfil atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (userId: string) => delFn({ data: { userId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_users"] }); toast.success("Usuário removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Usuários</h2>
          <p className="text-sm text-muted-foreground">Admins editam o site e tags. Consultores acessam o CRM.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" /> Novo usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar usuário</DialogTitle>
              <DialogDescription>O usuário poderá acessar imediatamente com o e-mail e senha definidos.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome completo</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Senha (mín. 8)</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div>
                <Label>Perfil</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "consultor" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultor">Consultor comercial</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
                {createM.isPending ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead><TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>}
            {users.map((u) => {
              const currentRole = (u.roles.includes("admin") ? "admin" : u.roles.includes("consultor") ? "consultor" : "") as "admin" | "consultor" | "";
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Select value={currentRole} onValueChange={(v) => roleM.mutate({ userId: u.id, role: v as "admin" | "consultor" })}>
                      <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Definir perfil" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consultor">Consultor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Excluir ${u.email}?`)) delM.mutate(u.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* -------------------------------- Settings -------------------------------- */

type Field = { key: keyof typeof DEFAULT_SETTINGS; label: string; textarea?: boolean; help?: string };

const SITE_FIELDS: Field[] = [
  { key: "whatsapp", label: "WhatsApp (só números, com DDI)", help: "Ex: 5543996172509" },
  { key: "phone", label: "Telefone (exibido)" },
  { key: "email", label: "E-mail de contato" },
  { key: "instagram", label: "URL do Instagram" },
  { key: "video_url", label: "URL do vídeo do YouTube (hero)" },
  { key: "hero_title", label: "Título principal (Hero)", textarea: true },
  { key: "hero_subtitle", label: "Subtítulo do Hero", textarea: true },
];

const TAG_FIELDS: Field[] = [
  { key: "gtm_id", label: "Google Tag Manager (Container ID)", help: "Ex: GTM-XXXXXXX" },
  { key: "ga4_measurement_id", label: "GA4 Measurement ID", help: "Ex: G-XXXXXXXXXX" },
  { key: "google_ads_id", label: "Google Ads Conversion ID", help: "Ex: AW-123456789" },
  { key: "google_ads_conversion_label", label: "Google Ads · label do Lead", help: "Etiqueta da conversão de formulário" },
  { key: "google_ads_sale_label", label: "Google Ads · label da Venda" },
  { key: "google_ads_faturado_label", label: "Google Ads · label do Faturado" },
  { key: "meta_pixel_id", label: "Meta Pixel ID", help: "Ex: 1234567890123456" },
  { key: "meta_test_event_code", label: "Meta CAPI Test Event Code (opcional)" },
  { key: "tiktok_pixel_id", label: "TikTok Pixel ID / Code", help: "Ex: C1XXXXXXXXXXXXXXXX" },
];

function SettingsPanel({ fields, title, description }: { fields: Field[]; title: string; description?: string }) {
  const { data: settings = DEFAULT_SETTINGS } = useSiteSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const value = (k: string) => form[k] ?? settings[k] ?? "";

  const save = useMutation({
    mutationFn: async () => {
      const rows = fields.map((f) => ({ key: f.key, value: value(f.key), updated_at: new Date().toISOString() }));
      const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["site_settings"] }); setForm({}); toast.success("Salvo!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-1">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mb-6">{description}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className={f.textarea ? "md:col-span-2" : ""}>
            <Label htmlFor={f.key}>{f.label}</Label>
            {f.textarea ? (
              <Textarea id={f.key} rows={2} value={value(f.key)} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className="mt-1.5" />
            ) : (
              <Input id={f.key} value={value(f.key)} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className="mt-1.5" />
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

function SecretsHelp() {
  return (
    <Card className="mt-4 p-6 bg-secondary/50">
      <h3 className="font-semibold mb-2">Tokens privados (APIs de Conversão)</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Para enviar conversões pelo servidor (Meta CAPI, TikTok Events, GA4 MP), me peça no chat para adicionar estes secrets:
      </p>
      <ul className="text-sm space-y-1 list-disc pl-5">
        <li><code>META_CAPI_ACCESS_TOKEN</code> — token de acesso do Meta Business (permissão ads_management).</li>
        <li><code>TIKTOK_EVENTS_ACCESS_TOKEN</code> — access token do Events API do TikTok Business.</li>
        <li><code>GA4_API_SECRET</code> — API secret do Measurement Protocol (Admin do GA4 → Data Streams).</li>
      </ul>
      <p className="text-xs text-muted-foreground mt-3">
        Sem os tokens, a conversão só é disparada pelos pixels do frontend. Com os tokens, o servidor envia eventos de <b>Lead</b>, <b>Venda</b> e <b>Faturado</b> ao mudar o estágio do lead no CRM.
      </p>
    </Card>
  );
}

/* --------------------------------- Ploomes -------------------------------- */

function PloomesPanel() {
  const qc = useQueryClient();
  const testFn = useServerFn(testPloomes);
  const syncLeadsFn = useServerFn(syncPloomesLeads);
  const syncPipesFn = useServerFn(syncPloomesPipelines);

  const { data: pipelines = [] } = useQuery({
    queryKey: ["ploomes_pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ploomes_pipelines").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["ploomes_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_sync_log")
        .select("*")
        .in("provider", ["ploomes_leads", "ploomes_pipelines"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const testM = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r: any) =>
      r.ok ? toast.success(`Conectado: ${r.account}`) : toast.error(r.message),
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["ploomes_pipelines"] });
    qc.invalidateQueries({ queryKey: ["ploomes_logs"] });
    qc.invalidateQueries({ queryKey: ["admin_leads"] });
    qc.invalidateQueries({ queryKey: ["crm_leads"] });
  };

  const syncPipesM = useMutation({
    mutationFn: () => syncPipesFn(),
    onSuccess: (r: any) => { toast.success(`${r.count} funis sincronizados`); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncLeadsM = useMutation({
    mutationFn: () => syncLeadsFn(),
    onSuccess: (r: any) => { toast.success(`${r.imported} novos, ${r.updated} atualizados (${r.total} lidos)`); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <PlugZap className="h-5 w-5 mt-1 text-primary" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Integração com Ploomes CRM</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Puxa contatos e funis do Ploomes para dentro deste CRM. Os leads importados
              ficam marcados com origem <b>Ploomes</b> e podem ser trabalhados no Kanban normalmente.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border bg-secondary/40 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium mb-2"><KeyRound className="h-4 w-4" /> Passo 1 — Cadastrar a User-Key</div>
          <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
            <li>No Ploomes, entre em <b>Administração → Integrações → Chaves de API</b> e gere uma <b>User Key</b>.</li>
            <li>Peça aqui no chat: <i>"salve minha PLOOMES_USER_KEY"</i> — vai abrir um campo seguro para colar a chave.</li>
            <li>Depois volte nesta aba e clique em <b>Testar conexão</b>.</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-2">
            A chave nunca fica salva no código — só no cofre de secrets do backend.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => testM.mutate()} disabled={testM.isPending} variant="outline">
            <PlugZap className="h-4 w-4 mr-2" />
            {testM.isPending ? "Testando..." : "Testar conexão"}
          </Button>
          <Button onClick={() => syncPipesM.mutate()} disabled={syncPipesM.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncPipesM.isPending ? "animate-spin" : ""}`} />
            Sincronizar funis
          </Button>
          <Button onClick={() => syncLeadsM.mutate()} disabled={syncLeadsM.isPending}>
            <Download className={`h-4 w-4 mr-2 ${syncLeadsM.isPending ? "animate-pulse" : ""}`} />
            Importar leads do Ploomes
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h4 className="font-semibold mb-3">Funis importados</h4>
        {pipelines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum funil ainda. Clique em "Sincronizar funis" após configurar a chave.</p>
        ) : (
          <div className="space-y-3">
            {pipelines.map((p: any) => (
              <div key={p.id} className="rounded-md border p-3">
                <div className="font-medium">{p.name}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(p.stages ?? []).map((s: any) => (
                    <Badge key={s.id} variant="secondary" className="text-xs">{s.name}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h4 className="font-semibold mb-3">Histórico de sincronização</h4>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sincronização ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Novos</TableHead>
                <TableHead className="text-right">Atualizados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-xs">{l.provider.replace("ploomes_", "")}</TableCell>
                  <TableCell><Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge></TableCell>
                  <TableCell className="text-right">{l.items_imported}</TableCell>
                  <TableCell className="text-right">{l.items_updated}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------- Appearance ------------------------------- */

const APPEARANCE_DEFAULTS: Record<string, string> = {
  primary_color: "#0E6A3C",
  cta_color: "#F26A21",
  background_color: "#FAFAF7",
  border_radius: "0.75",
};

function AppearancePanel() {
  const { data: settings = DEFAULT_SETTINGS } = useSiteSettings();
  const qc = useQueryClient();
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const val = (k: string) => form[k] ?? settings[k] ?? "";
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const keys = ["logo_url", "primary_color", "cta_color", "background_color", "border_radius"];

  const save = useMutation({
    mutationFn: async () => {
      const rows = keys.map((k) => ({ key: k, value: val(k), updated_at: new Date().toISOString() }));
      const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site_settings"] });
      router.invalidate();
      setForm({});
      toast.success("Aparência atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const resetAll = () => {
    setForm({ logo_url: "", primary_color: "", cta_color: "", background_color: "", border_radius: "" });
    toast.info("Clique em Salvar para aplicar o padrão.");
  };

  const onLogoFile = async (file: File) => {
    if (file.size > 500_000) {
      toast.error("Logo grande demais (máx 500 KB). Comprima antes de enviar.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      set("logo_url", dataUrl);
    } finally {
      setUploading(false);
    }
  };

  const ColorField = ({ k, label }: { k: string; label: string }) => {
    const current = val(k) || APPEARANCE_DEFAULTS[k] || "#000000";
    return (
      <div>
        <Label>{label}</Label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="color"
            value={current}
            onChange={(e) => set(k, e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent p-1"
          />
          <Input
            value={val(k)}
            placeholder={APPEARANCE_DEFAULTS[k] || ""}
            onChange={(e) => set(k, e.target.value)}
            className="flex-1"
          />
          {val(k) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => set(k, "")}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const currentLogo = val("logo_url");
  const radius = val("border_radius") || APPEARANCE_DEFAULTS.border_radius;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <Palette className="h-5 w-5 mt-1 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Aparência do site</h2>
            <p className="text-sm text-muted-foreground">
              Troque a logo, ajuste cores e o quanto os botões são arredondados. As mudanças aplicam em todo o site.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <Label>Logo</Label>
            <div className="mt-1.5 flex items-center gap-4 rounded-lg border bg-secondary/30 p-4">
              <div className="flex h-16 w-32 items-center justify-center rounded bg-primary/90 px-2">
                {currentLogo ? (
                  <img src={currentLogo} alt="Logo atual" className="max-h-14 max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-primary-foreground/70">Logo padrão</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-secondary">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Enviando..." : "Escolher arquivo (PNG/SVG)"}
                  <input
                    type="file"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onLogoFile(e.target.files[0])}
                  />
                </label>
                {currentLogo && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set("logo_url", "")}>
                    Remover (voltar ao padrão)
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-2">
              <Input
                placeholder="Ou cole uma URL da logo (https://...)"
                value={currentLogo.startsWith("data:") ? "" : currentLogo}
                onChange={(e) => set("logo_url", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <ColorField k="primary_color" label="Cor do cabeçalho e botões primários" />
            <ColorField k="cta_color" label="Cor do botão principal (CTA)" />
            <ColorField k="background_color" label="Cor de fundo do site" />
          </div>

          <div className="md:col-span-2">
            <Label>Arredondamento dos botões e cards ({radius}rem)</Label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={Number(radius)}
                onChange={(e) => set("border_radius", e.target.value)}
                className="flex-1"
              />
              <Input
                value={val("border_radius")}
                placeholder="0.75"
                onChange={(e) => set("border_radius", e.target.value)}
                className="w-24"
              />
            </div>
            <div className="mt-3 flex gap-3">
              <Button style={{ borderRadius: `${Number(radius)}rem` }}>Botão de exemplo</Button>
              <Button variant="outline" style={{ borderRadius: `${Number(radius)}rem` }}>
                Outro exemplo
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar aparência"}
          </Button>
          <Button variant="outline" onClick={resetAll}>
            <RotateCcw className="h-4 w-4 mr-2" /> Restaurar padrão
          </Button>
        </div>
      </Card>
    </div>
  );
}
