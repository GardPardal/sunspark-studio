import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import { LogOut, Download, ExternalLink, Sun, UserPlus, Trash2, Kanban } from "lucide-react";
import { DEFAULT_SETTINGS, useSiteSettings } from "@/lib/site-settings";
import { listUsers, createUser, deleteUser, setUserRole } from "@/lib/admin-users.functions";
import { assignLead } from "@/lib/crm.functions";

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
            <TabsTrigger value="tags">Tags & Pixels</TabsTrigger>
            <TabsTrigger value="ploomes">Ploomes</TabsTrigger>
          </TabsList>
          <TabsContent value="leads" className="mt-6"><LeadsPanel /></TabsContent>
          <TabsContent value="users" className="mt-6"><UsersPanel /></TabsContent>
          <TabsContent value="site" className="mt-6"><SettingsPanel fields={SITE_FIELDS} title="Conteúdo do site" /></TabsContent>
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

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["admin_leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const listUsersFn = useServerFn(listUsers);
  const { data: users = [] } = useQuery({ queryKey: ["admin_users"], queryFn: () => listUsersFn() });
  const consultores = users.filter((u) => u.roles.includes("consultor") || u.roles.includes("admin"));

  const assignFn = useServerFn(assignLead);
  const assignM = useMutation({
    mutationFn: (v: { leadId: string; assignedTo: string | null }) => assignFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_leads"] }); toast.success("Atribuição atualizada"); },
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
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
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
