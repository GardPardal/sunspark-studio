import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Sun, Code2, Headset, ArrowLeft, LineChart } from "lucide-react";

type Profile = "consultor" | "coordenador" | "desenvolvedor";

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
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  const isAdmin = roles.includes("admin");
  const isConsultor = roles.includes("consultor");
  const isCoord = roles.includes("coordenador");

  if (chosen === "desenvolvedor") {
    if (!isAdmin) {
      toast.error("Este usuário não tem acesso de desenvolvedor.");
      await supabase.auth.signOut();
      return;
    }
    navigate({ to: "/admin" });
  } else if (chosen === "coordenador") {
    if (!isCoord && !isAdmin) {
      toast.error("Este usuário não tem acesso de coordenador.");
      await supabase.auth.signOut();
      return;
    }
    navigate({ to: "/coordenacao" });
  } else {
    if (!isConsultor && !isCoord && !isAdmin) {
      toast.error("Este usuário não tem acesso de consultor.");
      await supabase.auth.signOut();
      return;
    }
    navigate({ to: "/crm" });
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && profile) {
        void routeByRole(data.session.user.id, profile, navigate);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Bem-vindo!");
      await routeByRole(data.user.id, profile, navigate);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
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
            <p className="text-sm text-muted-foreground mb-6">
              Escolha o tipo de acesso ao painel.
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setProfile("consultor")}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="rounded-md bg-primary/10 p-3 text-primary">
                  <Headset className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold">Consultor Comercial</div>
                  <div className="text-xs text-muted-foreground">Acesso ao CRM de leads e vendas.</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setProfile("coordenador")}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="rounded-md bg-primary/10 p-3 text-primary">
                  <LineChart className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold">Coordenador Comercial</div>
                  <div className="text-xs text-muted-foreground">BI, kanban por consultor e transferências.</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setProfile("desenvolvedor")}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition text-left"
              >
                <div className="rounded-md bg-primary/10 p-3 text-primary">
                  <Code2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-semibold">Desenvolvedor / Admin</div>
                  <div className="text-xs text-muted-foreground">Editar site, tags, usuários e CRM.</div>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setProfile(null)}
              className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-3 w-3" /> Trocar perfil
            </button>
            <h1 className="text-2xl font-semibold mb-1">
              Entrar como {profile === "consultor" ? "Consultor" : profile === "coordenador" ? "Coordenador" : "Desenvolvedor"}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Informe suas credenciais para acessar o painel.
            </p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" autoComplete="current-password" />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Aguarde..." : "Entrar"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
