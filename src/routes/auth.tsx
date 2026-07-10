import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sun, Code2, Headset, ArrowLeft, LineChart, UserPlus, KeyRound } from "lucide-react";

type Profile = "consultor" | "coordenador" | "desenvolvedor";

async function ensureApprovedLoginUnlocked(email: string) {
  try {
    const response = await fetch("/api/public/ensure-approved-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Painel LZ7 Energia" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

async function routeByRole(userId: string, chosen: Profile, navigate: ReturnType<typeof useNavigate>) {
  const [{ data: rolesData }, { data: profileData }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("status").eq("id", userId).maybeSingle(),
  ]);
  if (profileData?.status === "pending") {
    toast.error("Sua conta ainda está aguardando aprovação do administrador.");
    await supabase.auth.signOut();
    return;
  }
  if (profileData?.status === "rejected") {
    toast.error("Sua conta foi rejeitada. Fale com o administrador.");
    await supabase.auth.signOut();
    return;
  }
  const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.includes("admin");
  const isConsultor = roles.includes("consultor");
  const isCoord = roles.includes("coordenador");
  const isSdr = roles.includes("sdr");

  if (chosen === "desenvolvedor") {
    if (!isAdmin) { toast.error("Este usuário não tem acesso de desenvolvedor."); await supabase.auth.signOut(); return; }
    navigate({ to: "/admin" });
  } else if (chosen === "coordenador") {
    if (!isCoord && !isAdmin && !isSdr) { toast.error("Este usuário não tem acesso à área de coordenação/SDR."); await supabase.auth.signOut(); return; }
    navigate({ to: "/coordenacao" });
  } else {
    if (!isConsultor && !isCoord && !isAdmin && !isSdr) { toast.error("Este usuário não tem acesso de consultor."); await supabase.auth.signOut(); return; }
    navigate({ to: "/crm" });
  }
}


function AuthPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // signup
  const [fullName, setFullName] = useState("");
  const [unit, setUnit] = useState<"londrina" | "ponta_grossa" | "wenceslau_braz" | "">("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && profile) void routeByRole(data.session.user.id, profile, navigate);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      let { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error && /email not confirmed|invalid login credentials|credenciais/i.test(error.message)) {
        await ensureApprovedLoginUnlocked(normalizedEmail);
        const retry = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      toast.success("Bem-vindo!");
      await routeByRole(data.user.id, profile, navigate);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) { toast.error("Escolha sua unidade."); return; }
    if (password.length < 8) { toast.error("Mínimo 8 caracteres."); return; }
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: signupData, error } = await supabase.auth.signUp({
        email: normalizedEmail, password,
        options: {
          data: { full_name: fullName, unit, self_signup: true },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;

      // Dispara email de aprovação para o admin (não bloqueia o fluxo)
      try {
        await fetch("/api/public/notify-approval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: signupData.user?.id, email: normalizedEmail }),
        });
      } catch (notifyErr) {
        console.warn("notify-approval failed", notifyErr);
      }

      toast.success("Cadastro enviado! O administrador foi avisado por email.");
      await supabase.auth.signOut();
      setMode("login");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      toast.success("Se este email existir, você receberá um link para redefinir a senha.");
      setMode("login");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md p-8 shadow-elegant border-primary/10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-primary">
          <Sun className="h-5 w-5" /> <span className="font-semibold">LZ7 Energia</span>
        </Link>

        {!profile ? (
          <>
            <h1 className="text-2xl font-semibold mb-1">Selecione seu perfil</h1>
            <p className="text-sm text-muted-foreground mb-6">Escolha o tipo de acesso ao painel.</p>
            <div className="space-y-3">
              <ProfileBtn onClick={() => setProfile("consultor")} icon={<Headset className="h-6 w-6" />} title="Consultor Comercial" desc="Acesso ao CRM de leads e vendas." />
              <ProfileBtn onClick={() => setProfile("coordenador")} icon={<LineChart className="h-6 w-6" />} title="Coordenador Comercial" desc="BI, roleta SDR e transferências." />
              <ProfileBtn onClick={() => setProfile("desenvolvedor")} icon={<Code2 className="h-6 w-6" />} title="Desenvolvedor / Admin" desc="Editar site, tags, usuários e CRM." />
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={() => { setProfile(null); setMode("login"); }} className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-3 w-3" /> Trocar perfil
            </button>
            <h1 className="text-2xl font-semibold mb-4">
              {profile === "consultor" ? "Consultor" : profile === "coordenador" ? "Coordenador" : "Desenvolvedor"}
            </h1>

            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup" disabled={profile !== "consultor"}>Cadastrar</TabsTrigger>
                <TabsTrigger value="forgot">Recuperar</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={submitLogin} className="space-y-4" autoComplete="on" method="post" action="#">
                  <div>
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">{loading ? "Aguarde..." : "Entrar"}</Button>
                  <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline w-full text-center">
                    Esqueci minha senha
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {profile !== "consultor" ? (
                  <p className="text-sm text-muted-foreground">Cadastro público é só para consultores. Coordenadores e admins são criados pelo master.</p>
                ) : (
                  <form onSubmit={submitSignup} className="space-y-4" autoComplete="on" method="post" action="#">
                    <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-xs">
                      <UserPlus className="h-3.5 w-3.5 inline mr-1 text-primary" />
                      Sua conta será revisada pelo administrador antes da liberação.
                    </div>
                    <div>
                      <Label htmlFor="signup-name">Nome completo</Label>
                      <Input
                        id="signup-name"
                        name="name"
                        autoComplete="name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div><Label>Unidade</Label>
                      <Select value={unit} onValueChange={(v) => setUnit(v as any)}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="londrina">Londrina</SelectItem>
                          <SelectItem value="ponta_grossa">Ponta Grossa</SelectItem>
                          <SelectItem value="wenceslau_braz">Wenceslau Braz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="signup-email">E-mail</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="signup-password">Senha (mín. 8)</Label>
                      <Input
                        id="signup-password"
                        name="new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading ? "Enviando..." : "Solicitar cadastro"}
                    </Button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="forgot">
                <form onSubmit={submitForgot} className="space-y-4" autoComplete="on" method="post" action="#">
                  <p className="text-xs text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5 inline mr-1" />
                    Enviaremos um link para redefinir sua senha.
                  </p>
                  <div>
                    <Label htmlFor="forgot-email">E-mail cadastrado</Label>
                    <Input
                      id="forgot-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">{loading ? "Enviando..." : "Enviar link"}</Button>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}
      </Card>
    </div>
  );
}

function ProfileBtn({ onClick, icon, title, desc }: { onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition text-left">
      <div className="rounded-md bg-primary/10 p-3 text-primary">{icon}</div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}
