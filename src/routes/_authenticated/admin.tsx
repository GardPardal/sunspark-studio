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
import { LogOut, Download, ExternalLink, Sun, UserPlus, Trash2, Kanban, RefreshCw, PlugZap, KeyRound, Palette, Upload, RotateCcw, CalendarClock, TrendingUp, Users2 } from "lucide-react";
import { DEFAULT_SETTINGS, useSiteSettings } from "@/lib/site-settings";
import { listUsers, createUser, deleteUser, setUserRole } from "@/lib/admin-users.functions";
import { assignLead, listCrmLeads } from "@/lib/crm.functions";
import { testPloomes, syncPloomesLeads, syncPloomesPipelines } from "@/lib/ploomes.functions";
import { listCadenceSteps, upsertCadenceStep, deleteCadenceStep, listTrafficSpend, upsertTrafficSpend, deleteTrafficSpend } from "@/lib/crm-advanced.functions";

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
              <Link to="/coordenacao"><TrendingUp className="h-4 w-4 mr-2" /> Coordenação</Link>
            </Button>
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
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="cadence"><CalendarClock className="h-3.5 w-3.5 mr-1" /> Cadência</TabsTrigger>
            <TabsTrigger value="traffic"><TrendingUp className="h-3.5 w-3.5 mr-1" /> Tráfego pago</TabsTrigger>
            <TabsTrigger value="site">Site</TabsTrigger>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            <TabsTrigger value="code">Código</TabsTrigger>
            <TabsTrigger value="tags">Tags & Pixels</TabsTrigger>
            <TabsTrigger value="ploomes">Ploomes</TabsTrigger>
          </TabsList>
          <TabsContent value="leads" className="mt-6"><LeadsPanel /></TabsContent>
          <TabsContent value="users" className="mt-6"><UsersPanel /></TabsContent>
          <TabsContent value="cadence" className="mt-6"><CadencePanel /></TabsContent>
          <TabsContent value="traffic" className="mt-6"><TrafficPanel /></TabsContent>
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
  const [form, setForm] = useState({ email: "", password: "", fullName: "", role: "consultor" as "admin" | "consultor" | "coordenador" });

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
    mutationFn: (v: { userId: string; role: "admin" | "consultor" | "coordenador" }) => setRoleFn({ data: v }),
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
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "consultor" | "coordenador" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultor">Consultor comercial</SelectItem>
                    <SelectItem value="coordenador">Coordenador comercial</SelectItem>
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
              const currentRole = (u.roles.includes("admin") ? "admin" : u.roles.includes("coordenador") ? "coordenador" : u.roles.includes("consultor") ? "consultor" : "") as "admin" | "consultor" | "coordenador" | "";
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Select value={currentRole} onValueChange={(v) => roleM.mutate({ userId: u.id, role: v as "admin" | "consultor" | "coordenador" })}>
                      <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Definir perfil" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consultor">Consultor</SelectItem>
                        <SelectItem value="coordenador">Coordenador</SelectItem>
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

/* ------------------------------ Code editor ------------------------------- */

type CodeField = {
  key: keyof typeof DEFAULT_SETTINGS;
  label: string;
  help: string;
  language: "css" | "html";
  rows?: number;
};

const CODE_FIELDS: CodeField[] = [
  {
    key: "custom_css",
    label: "CSS personalizado",
    help: "Regras CSS globais aplicadas ao site inteiro. Injetadas em <style> no <head>.",
    language: "css",
    rows: 14,
  },
  {
    key: "custom_head_html",
    label: "HTML no <head>",
    help: "Meta tags, fontes, verificações, links, <style> ou <script> extras. Cuidado: código quebrado pode travar a página.",
    language: "html",
    rows: 10,
  },
  {
    key: "custom_body_html",
    label: "HTML no final do <body>",
    help: "Widgets de chat, popups, scripts assíncronos, iframes. Injetado depois de todo o conteúdo do site.",
    language: "html",
    rows: 10,
  },
  {
    key: "custom_block_top_html",
    label: "Bloco no topo da home",
    help: "HTML exibido logo abaixo do cabeçalho na página inicial. Ex: banner promocional, alerta, faixa institucional.",
    language: "html",
    rows: 12,
  },
  {
    key: "custom_block_bottom_html",
    label: "Bloco antes do rodapé da home",
    help: "HTML exibido antes do rodapé na página inicial. Ex: seção de parceiros, chamada extra, embed de mapa.",
    language: "html",
    rows: 12,
  },
];

function CodeEditorPanel() {
  const { data: settings = DEFAULT_SETTINGS } = useSiteSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const [active, setActive] = useState<CodeField["key"]>(CODE_FIELDS[0].key);
  const qc = useQueryClient();
  const value = (k: string) => form[k] ?? settings[k] ?? "";
  const current = CODE_FIELDS.find((f) => f.key === active)!;
  const dirty = Object.keys(form).length > 0;

  const save = useMutation({
    mutationFn: async () => {
      const rows = CODE_FIELDS
        .filter((f) => form[f.key] !== undefined)
        .map((f) => ({ key: f.key, value: form[f.key], updated_at: new Date().toISOString() }));
      if (!rows.length) return;
      const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site_settings"] });
      setForm({});
      toast.success("Código salvo. Recarregue o site para ver as mudanças.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearField = () => setForm((s) => ({ ...s, [active]: "" }));

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <Palette className="h-5 w-5 mt-1 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Editor de código do site</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Insira CSS, HTML e scripts personalizados sem tocar no código-fonte — no estilo do editor de temas da Loja Integrada / Tray.
              As mudanças valem para o site inteiro assim que forem salvas.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Código com erro (tag aberta, aspas quebradas, script inválido) pode fazer parte do site parar de aparecer. Teste sempre em uma aba anônima antes de divulgar.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap gap-1 border-b bg-secondary/40 p-2">
          {CODE_FIELDS.map((f) => {
            const filled = (value(f.key) || "").trim().length > 0;
            const isActive = f.key === active;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setActive(f.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="mr-1 uppercase text-[10px] opacity-60">{f.language}</span>
                {f.label}
                {filled && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}
              </button>
            );
          })}
        </div>

        <div className="p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label htmlFor={current.key} className="text-sm font-semibold">{current.label}</Label>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{current.help}</p>
            </div>
            <Button variant="outline" size="sm" onClick={clearField} disabled={!value(current.key)}>
              Limpar
            </Button>
          </div>

          <div className="relative rounded-md border bg-[#0f172a] text-slate-100">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] uppercase tracking-wider text-slate-400">
              <span>{current.language === "css" ? "style.css" : "custom.html"}</span>
              <span>{(value(current.key) || "").length} caracteres</span>
            </div>
            <Textarea
              id={current.key}
              rows={current.rows ?? 12}
              spellCheck={false}
              value={value(current.key)}
              onChange={(e) => setForm((s) => ({ ...s, [current.key]: e.target.value }))}
              placeholder={
                current.language === "css"
                  ? "/* Ex: */\n.hero-title { letter-spacing: -0.02em; }\n.btn-primary { transition: transform .2s ease; }\n.btn-primary:hover { transform: translateY(-1px); }"
                  : '<!-- Ex: -->\n<section style="background:#0d5c3f;color:#fff;padding:16px;text-align:center;">\n  <strong>Promoção de janeiro:</strong> desconto de 8% em sistemas acima de 5 kWp.\n</section>'
              }
              className="min-h-[240px] resize-y rounded-none border-0 bg-transparent font-mono text-[13px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
              {save.isPending ? "Salvando..." : "Salvar código"}
            </Button>
            {dirty && (
              <Button variant="ghost" onClick={() => setForm({})}>Descartar alterações</Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              Dica: use <code className="rounded bg-secondary px-1 py-0.5">Ctrl/Cmd + S</code> ao terminar de editar cada aba.
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ CADÊNCIA ------------------------------ */

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  email: "E-mail",
  presencial: "Presencial",
};

function CadencePanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCadenceSteps);
  const upsertFn = useServerFn(upsertCadenceStep);
  const delFn = useServerFn(deleteCadenceStep);

  const { data: steps = [] } = useQuery({ queryKey: ["cadence_steps"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const emptyForm = { id: null as string | null, day_offset: 0, channel: "whatsapp", title: "", description: "", ordem: 0, active: true };
  const [form, setForm] = useState<any>(emptyForm);

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ ...s, description: s.description ?? "" });
    setOpen(true);
  };
  const openNew = () => { setEditing(null); setForm({ ...emptyForm, ordem: (steps.length ? Math.max(...steps.map((x: any) => x.ordem)) + 1 : 1) }); setOpen(true); };

  const saveM = useMutation({
    mutationFn: () => upsertFn({ data: { ...form, day_offset: Number(form.day_offset), ordem: Number(form.ordem) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cadence_steps"] }); setOpen(false); toast.success("Passo salvo."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cadence_steps"] }); toast.success("Passo removido."); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Cadência de atendimento</h2>
          <p className="text-sm text-muted-foreground">
            Fluxograma que cada consultor deve seguir. Quando um lead entra em "Em atendimento", o sistema gera automaticamente as tarefas abaixo com base nos dias.
          </p>
        </div>
        <Button onClick={openNew}>+ Novo passo</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Dia</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum passo cadastrado.</TableCell></TableRow>
            )}
            {steps.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell><Badge variant="secondary">D+{s.day_offset}</Badge></TableCell>
                <TableCell>{CHANNEL_LABEL[s.channel] ?? s.channel}</TableCell>
                <TableCell>
                  <div className="font-medium">{s.title}</div>
                  {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                </TableCell>
                <TableCell>{s.ordem}</TableCell>
                <TableCell>{s.active ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover este passo?")) delM.mutate(s.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar passo" : "Novo passo"}</DialogTitle>
            <DialogDescription>Cada passo vira uma tarefa automática para o consultor no dia indicado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Dia (D+)</Label>
              <Input type="number" min={0} value={form.day_offset} onChange={(e) => setForm({ ...form, day_offset: e.target.value })} />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" min={0} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição / roteiro</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Ativo
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending || !form.title}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------------ TRÁFEGO PAGO ------------------------------ */

function TrafficPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTrafficSpend);
  const upsertFn = useServerFn(upsertTrafficSpend);
  const delFn = useServerFn(deleteTrafficSpend);

  const { data: rows = [] } = useQuery({ queryKey: ["traffic_spend"], queryFn: () => listFn() });

  const today = new Date().toISOString().slice(0, 10);
  const empty = {
    id: null as string | null,
    spend_date: today,
    channel: "Meta Ads",
    campaign: "",
    amount: "",
    notes: "",
    start_date: today,
    end_date: "",
    status: "active",
    impressions: "",
    clicks: "",
    leads_count: "",
    objective: "",
    platform_url: "",
  };
  const [form, setForm] = useState<any>(empty);
  const [open, setOpen] = useState(false);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (r: any) => setForm({
    id: r.id,
    spend_date: r.spend_date,
    channel: r.channel,
    campaign: r.campaign ?? "",
    amount: String(r.amount ?? ""),
    notes: r.notes ?? "",
    start_date: r.start_date ?? r.spend_date,
    end_date: r.end_date ?? "",
    status: r.status ?? "active",
    impressions: String(r.impressions ?? ""),
    clicks: String(r.clicks ?? ""),
    leads_count: String(r.leads_count ?? ""),
    objective: r.objective ?? "",
    platform_url: r.platform_url ?? "",
  });

  useEffect(() => {
    if (open) setOpen(true);
  }, [open]);

  const saveM = useMutation({
    mutationFn: () => upsertFn({
      data: {
        id: form.id,
        spend_date: form.spend_date,
        channel: form.channel,
        campaign: form.campaign || null,
        amount: Number(String(form.amount).replace(",", ".")) || 0,
        notes: form.notes || null,
        start_date: form.start_date || form.spend_date,
        end_date: form.end_date || null,
        status: form.status,
        impressions: Number(form.impressions) || 0,
        clicks: Number(form.clicks) || 0,
        leads_count: Number(form.leads_count) || 0,
        objective: form.objective || null,
        platform_url: form.platform_url || null,
      },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["traffic_spend"] }); setOpen(false); toast.success("Campanha salva."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["traffic_spend"] }); toast.success("Removido."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalMes = rows
    .filter((r: any) => String(r.spend_date).slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  const daysRunning = (r: any) => {
    const s = new Date(r.start_date ?? r.spend_date);
    const e = r.end_date ? new Date(r.end_date) : (r.status === "active" ? new Date() : new Date(r.updated_at ?? r.spend_date));
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400_000) + 1);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      active: { label: "Rodando", cls: "bg-green-100 text-green-800" },
      paused: { label: "Pausada", cls: "bg-yellow-100 text-yellow-800" },
      ended: { label: "Encerrada", cls: "bg-gray-200 text-gray-800" },
      draft: { label: "Rascunho", cls: "bg-blue-100 text-blue-800" },
    };
    const it = map[s] || map.active;
    return <span className={`inline-flex px-2 py-0.5 rounded text-xs ${it.cls}`}>{it.label}</span>;
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Investimento em tráfego pago</h2>
          <p className="text-sm text-muted-foreground">
            Registre cada campanha com valor, período, status e métricas do Meta/Google Ads. O BI calcula CPL, CPC e ROAS em tempo real.
          </p>
          <p className="text-xs mt-1">
            Total no mês: <strong className="text-primary">{totalMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
          </p>
        </div>
        <Button onClick={openNew}>+ Nova campanha</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Investido</TableHead>
              <TableHead className="text-right">Impr.</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">CPL</TableHead>
              <TableHead className="text-right">CPC</TableHead>
              <TableHead className="text-right">Dias</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-6">Nenhuma campanha cadastrada.</TableCell></TableRow>}
            {rows.map((r: any) => {
              const dias = daysRunning(r);
              const cpl = r.leads_count > 0 ? Number(r.amount) / r.leads_count : 0;
              const cpc = r.clicks > 0 ? Number(r.amount) / r.clicks : 0;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    <div className="font-medium">{r.campaign || "—"}</div>
                    {r.objective && <div className="text-xs text-muted-foreground">{r.objective}</div>}
                    {r.platform_url && <a href={r.platform_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">abrir no Ads</a>}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{r.channel}</Badge></TableCell>
                  <TableCell>{statusBadge(r.status ?? "active")}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(r.start_date ?? r.spend_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    {" → "}
                    {r.end_date ? new Date(r.end_date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "hoje"}
                  </TableCell>
                  <TableCell className="text-right font-medium">{Number(r.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell className="text-right text-xs">{Number(r.impressions || 0).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right text-xs">{Number(r.clicks || 0).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right text-xs">{Number(r.leads_count || 0).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right text-xs">{cpl ? cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</TableCell>
                  <TableCell className="text-right text-xs">{cpc ? cpc.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</TableCell>
                  <TableCell className="text-right text-xs">{dias}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => { openEdit(r); setOpen(true); }}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover?")) delM.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar campanha" : "Nova campanha"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Meta Ads">Meta Ads (Facebook/Instagram)</SelectItem>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                  <SelectItem value="TikTok Ads">TikTok Ads</SelectItem>
                  <SelectItem value="YouTube Ads">YouTube Ads</SelectItem>
                  <SelectItem value="LinkedIn Ads">LinkedIn Ads</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Rodando (play)</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="ended">Encerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Nome da campanha</Label>
              <Input value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} placeholder="Ex: Solar-Residencial-Interesse-SP" />
            </div>
            <div>
              <Label>Objetivo</Label>
              <Input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Ex: Conversões / Leads / Tráfego" />
            </div>
            <div>
              <Label>Link do gerenciador (opcional)</Label>
              <Input value={form.platform_url} onChange={(e) => setForm({ ...form, platform_url: e.target.value })} placeholder="https://adsmanager.facebook.com/..." />
            </div>
            <div>
              <Label>Data de início</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, spend_date: e.target.value })} />
            </div>
            <div>
              <Label>Data de término (se pausada/encerrada)</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div>
              <Label>Valor investido (R$)</Label>
              <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
            </div>
            <div>
              <Label>Leads gerados (da plataforma)</Label>
              <Input type="number" min={0} value={form.leads_count} onChange={(e) => setForm({ ...form, leads_count: e.target.value })} placeholder="0" />
            </div>
            <div>
              <Label>Impressões</Label>
              <Input type="number" min={0} value={form.impressions} onChange={(e) => setForm({ ...form, impressions: e.target.value })} placeholder="0" />
            </div>
            <div>
              <Label>Cliques</Label>
              <Input type="number" min={0} value={form.clicks} onChange={(e) => setForm({ ...form, clicks: e.target.value })} placeholder="0" />
            </div>
            <div className="sm:col-span-2 rounded-md bg-muted/40 p-3 text-xs space-y-1">
              <div><strong>CPL calculado:</strong> {(() => {
                const a = Number(String(form.amount).replace(",", ".")) || 0;
                const l = Number(form.leads_count) || 0;
                return l ? (a / l).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
              })()}</div>
              <div><strong>CPC calculado:</strong> {(() => {
                const a = Number(String(form.amount).replace(",", ".")) || 0;
                const c = Number(form.clicks) || 0;
                return c ? (a / c).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
              })()}</div>
              <div><strong>CTR calculado:</strong> {(() => {
                const i = Number(form.impressions) || 0;
                const c = Number(form.clicks) || 0;
                return i ? `${((c / i) * 100).toFixed(2)}%` : "—";
              })()}</div>
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex: pausada por baixa performance, aumentado orçamento em 20/07..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


