import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Sun } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ title: "Redefinir senha — LZ7 Energia" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase envia com hash #access_token=&type=recovery
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady(true);
    } else {
      // Se já há sessão de recovery ativa
      supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { toast.error("As senhas não conferem."); return; }
    if (pw.length < 8) { toast.error("Mínimo 8 caracteres."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Senha atualizada! Faça login.");
      await supabase.auth.signOut();
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md p-8 shadow-elegant border-primary/10">
        <div className="mb-6 inline-flex items-center gap-2 text-primary">
          <Sun className="h-5 w-5" /> <span className="font-semibold">LZ7 Energia</span>
        </div>
        <h1 className="text-2xl font-semibold mb-1">Redefinir senha</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {ready ? "Escolha uma nova senha para acessar o painel." : "Abra este link a partir do email que você recebeu."}
        </p>
        {ready && (
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Nova senha</Label><Input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div><Label>Confirmar nova senha</Label><Input type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</Button>
          </form>
        )}
        <div className="mt-6 text-center">
          <Link to="/auth" className="text-xs text-muted-foreground hover:text-primary">Voltar ao login</Link>
        </div>
      </Card>
    </div>
  );
}
