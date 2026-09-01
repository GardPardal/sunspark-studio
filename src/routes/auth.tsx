import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Code2,
  Headset,
  ArrowLeft,
  LineChart,
  UserPlus,
  KeyRound,
  UserRoundSearch,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

type Profile = "consultor" | "coordenador" | "desenvolvedor" | "rh";

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
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next:
      typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
        ? s.next
        : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Painel Solar OS — LZ7 Energia" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

async function routeByRole(
  userId: string,
  chosen: Profile,
  navigate: ReturnType<typeof useNavigate>,
) {
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
  const isRh = roles.includes("rh");

  if (chosen === "rh") {
    if (!isRh && !isAdmin) {
      toast.error("Este usuário não tem acesso ao painel de RH.");
      await supabase.auth.signOut();
      return;
    }
    navigate({ to: "/mod/rh" });
  } else if (chosen === "desenvolvedor") {
    if (!isAdmin) {
      toast.error("Este usuário não tem acesso de desenvolvedor.");
      await supabase.auth.signOut();
      return;
    }
    navigate({ to: "/admin" });
  } else if (chosen === "coordenador") {
    if (!isCoord && !isAdmin && !isSdr) {
      toast.error("Este usuário não tem acesso à área de coordenação/SDR.");
      await supabase.auth.signOut();
      return;
    }
    navigate({ to: "/coordenacao" });
  } else {
    if (!isConsultor && !isCoord && !isAdmin && !isSdr) {
      toast.error("Este usuário não tem acesso de consultor.");
      await supabase.auth.signOut();
      return;
    }
    navigate({ to: "/crm" });
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // signup
  const [fullName, setFullName] = useState("");
  const [unit, setUnit] = useState<"londrina" | "ponta_grossa" | "wenceslau_braz" | "">("");

  const [loading, setLoading] = useState(false);

  const goNextOrRole = async (userId: string, chosen: Profile) => {
    if (next) {
      window.location.href = next;
      return;
    }
    await routeByRole(userId, chosen, navigate);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && profile) void goNextOrRole(data.session.user.id, profile);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      let { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (
        error &&
        /email not confirmed|invalid login credentials|credenciais/i.test(error.message)
      ) {
        await ensureApprovedLoginUnlocked(normalizedEmail);
        const retry = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        data = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      if (!data.user) throw new Error("Não foi possível iniciar a sessão. Tente novamente.");
      toast.success("Bem-vindo ao Solar OS!");
      await goNextOrRole(data.user.id, profile);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) {
      toast.error("Escolha sua unidade.");
      return;
    }
    if (password.length < 8) {
      toast.error("Mínimo 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: signupData, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
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
    } finally {
      setLoading(false);
    }
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#050b14] overflow-hidden">
      {/* Fundo Escuro com Textura e Brilhos Sutis */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(rgba(34, 197, 94, 0.2) 1px, transparent 1px), radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          backgroundPosition: "0 0, 16px 16px",
        }}
      />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-lzgreen/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Card Principal */}
      <Card className="relative z-10 w-full max-w-md p-8 bg-[#0b1523]/90 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] rounded-3xl text-white">
        {/* Topo com a Logo LZ7 */}
        <div className="flex flex-col items-center justify-center mb-8">
          <Link to="/" className="group transition-transform duration-300 hover:scale-105">
            <img
              src="/lz7-logo.png"
              alt="LZ7 Energia"
              className="h-16 md:h-20 w-auto object-contain drop-shadow-[0_12px_28px_rgba(34,197,94,0.3)]"
            />
          </Link>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
            <Sparkles className="h-3 w-3" /> Solar OS • Acesso Corporativo
          </div>
        </div>

        {!profile ? (
          <>
            <h1 className="text-xl font-bold tracking-tight text-white mb-1 text-center">
              Selecione seu perfil
            </h1>
            <p className="text-xs text-white/60 mb-6 text-center">
              Escolha seu tipo de acesso para continuar.
            </p>
            <div className="space-y-3">
              <ProfileBtn
                onClick={() => setProfile("consultor")}
                icon={<Headset className="h-5 w-5" />}
                title="Consultor Comercial"
                desc="CRM de leads, prospecção e vendas."
              />
              <ProfileBtn
                onClick={() => setProfile("coordenador")}
                icon={<LineChart className="h-5 w-5" />}
                title="Coordenador Comercial"
                desc="BI executivo, roleta SDR e transferências."
              />
              <ProfileBtn
                onClick={() => setProfile("rh")}
                icon={<UserRoundSearch className="h-5 w-5" />}
                title="Recursos Humanos (RH)"
                desc="Candidaturas, vagas e talentos."
              />
              <ProfileBtn
                onClick={() => setProfile("desenvolvedor")}
                icon={<Code2 className="h-5 w-5" />}
                title="Desenvolvedor / Admin"
                desc="Configurações, automações e sistema."
              />
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setProfile(null);
                setMode("login");
              }}
              className="mb-4 inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-emerald-400 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar aos perfis
            </button>
            <div className="mb-5 flex items-center justify-between">
              <h1 className="text-lg font-bold text-white">
                {profile === "consultor"
                  ? "Acesso Consultor"
                  : profile === "coordenador"
                    ? "Acesso Coordenador"
                    : profile === "rh"
                      ? "Acesso RH"
                      : "Acesso Desenvolvedor"}
              </h1>
              <span className="text-[11px] font-semibold text-emerald-400/90 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                {profile.toUpperCase()}
              </span>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList className="grid grid-cols-3 mb-5 bg-black/40 border border-white/10 p-1 rounded-xl">
                <TabsTrigger
                  value="login"
                  className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-navy-deep font-bold text-xs"
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  disabled={profile !== "consultor"}
                  className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-navy-deep font-bold text-xs"
                >
                  Cadastrar
                </TabsTrigger>
                <TabsTrigger
                  value="forgot"
                  className="rounded-lg data-[state=active]:bg-emerald-500 data-[state=active]:text-navy-deep font-bold text-xs"
                >
                  Recuperar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form
                  onSubmit={submitLogin}
                  className="space-y-4"
                  autoComplete="on"
                  method="post"
                  action="#"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-xs font-semibold text-white/80">
                      E-mail Corporativo
                    </Label>
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      placeholder="seu.nome@lz7energia.com.br"
                      autoComplete="username"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-black/30 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 focus:ring-emerald-400/20 rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-xs font-semibold text-white/80">
                      Senha de Acesso
                    </Label>
                    <Input
                      id="login-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-black/30 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 focus:ring-emerald-400/20 rounded-xl h-11"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-navy-deep font-extrabold shadow-lg rounded-xl h-11 text-sm mt-2 transition"
                  >
                    {loading ? "Autenticando..." : "Entrar no Solar OS"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-white/50 hover:text-emerald-400 transition w-full text-center mt-2 block"
                  >
                    Esqueci minha senha
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {profile !== "consultor" ? (
                  <p className="text-xs text-white/60 p-4 bg-white/5 rounded-xl border border-white/10 text-center">
                    O cadastro público é exclusivo para consultores. Contas de coordenação, SDR e
                    admin são liberadas pela diretoria.
                  </p>
                ) : (
                  <form
                    onSubmit={submitSignup}
                    className="space-y-3.5"
                    autoComplete="on"
                    method="post"
                    action="#"
                  >
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300">
                      <UserPlus className="h-3.5 w-3.5 inline mr-1 text-emerald-400" />
                      Sua solicitação passará por aprovação do coordenador antes de liberar o
                      acesso.
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="signup-name" className="text-xs font-semibold text-white/80">
                        Nome Completo
                      </Label>
                      <Input
                        id="signup-name"
                        name="name"
                        placeholder="Ex: João da Silva"
                        autoComplete="name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-black/30 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 rounded-xl h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-white/80">
                        Unidade de Atuação
                      </Label>
                      <Select value={unit} onValueChange={(v) => setUnit(v as any)}>
                        <SelectTrigger className="bg-black/30 border-white/15 text-white rounded-xl h-10 text-sm">
                          <SelectValue placeholder="Selecione sua base..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0b1523] border-white/15 text-white">
                          <SelectItem value="londrina">Londrina - PR</SelectItem>
                          <SelectItem value="ponta_grossa">Ponta Grossa - PR</SelectItem>
                          <SelectItem value="wenceslau_braz">Wenceslau Braz - PR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="signup-email" className="text-xs font-semibold text-white/80">
                        E-mail
                      </Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="seu.email@exemplo.com"
                        autoComplete="username"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-black/30 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 rounded-xl h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="signup-password"
                        className="text-xs font-semibold text-white/80"
                      >
                        Senha (mín. 8 caracteres)
                      </Label>
                      <Input
                        id="signup-password"
                        name="new-password"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-black/30 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 rounded-xl h-10 text-sm"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-navy-deep font-extrabold shadow-lg rounded-xl h-11 text-sm mt-1 transition"
                    >
                      {loading ? "Enviando solicitação..." : "Solicitar Acesso ao CRM"}
                    </Button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="forgot">
                <form
                  onSubmit={submitForgot}
                  className="space-y-4"
                  autoComplete="on"
                  method="post"
                  action="#"
                >
                  <p className="text-xs text-white/70 leading-relaxed">
                    <KeyRound className="h-3.5 w-3.5 inline mr-1 text-emerald-400" />
                    Informe seu e-mail corporativo cadastrado para receber o link seguro de
                    recuperação de senha.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs font-semibold text-white/80">
                      E-mail Cadastrado
                    </Label>
                    <Input
                      id="forgot-email"
                      name="email"
                      type="email"
                      placeholder="seu.email@lz7energia.com.br"
                      autoComplete="username"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-black/30 border-white/15 text-white placeholder:text-white/30 focus:border-emerald-400 rounded-xl h-11"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-navy-deep font-extrabold shadow-lg rounded-xl h-11 text-sm transition"
                  >
                    {loading ? "Enviando link..." : "Enviar Link de Redefinição"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </>
        )}

        <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/80" /> Ambiente Seguro 256-bit
          </span>
          <Link to="/" className="hover:text-white transition">
            lz7energia.com.br
          </Link>
        </div>
      </Card>
    </div>
  );
}

function ProfileBtn({
  onClick,
  icon,
  title,
  desc,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3.5 rounded-2xl border border-white/10 bg-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all duration-200 text-left group cursor-pointer"
    >
      <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-navy-deep transition-colors">
        {icon}
      </div>
      <div>
        <div className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
          {title}
        </div>
        <div className="text-xs text-white/50">{desc}</div>
      </div>
    </button>
  );
}
