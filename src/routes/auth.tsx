import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Entrar — Orbit" },
      { name: "description", content: "Acesse sua agenda de prospecção comercial no Orbit." },
      { property: "og:title", content: "Entrar — Orbit" },
      { property: "og:description", content: "Acesse sua agenda de prospecção comercial no Orbit." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          window.location.href = "/dashboard";
          return;
        }
        toast.success("Conta criada. Você já pode entrar.");
        setMode("signin");

      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        window.location.href = "/dashboard";
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar");
    } finally {
      setLoading(false);
    }
  }

  async function sendReset() {
    if (!email.trim()) {
      toast.error("Digite seu e-mail primeiro");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos um link para você definir sua senha.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o e-mail");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Falha ao entrar com Google");
      return;
    }
    if (result.redirected) return;
    window.location.href = "/dashboard";
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_460px]">
      <div className="relative hidden overflow-hidden border-r border-border bg-surface lg:block">
        <div className="absolute inset-0 opacity-[0.35] [background:radial-gradient(600px_at_30%_20%,var(--accent),transparent_65%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">O</span>
            <span className="text-sm font-medium">Orbit</span>
          </div>
          <div className="max-w-md">
            <h1 className="text-3xl font-medium leading-tight tracking-tight">
              Agende uma reunião sem interromper a ligação.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Agenda, lembretes, histórico do cliente e modo ligação — tudo em uma superfície rápida,
              feita para quem prospecta ao vivo.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Prospecção comercial · CRM leve · Tempo real</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-rise">
          <p className="text-eyebrow">{mode === "signin" ? "Bem-vindo de volta" : "Comece agora"}</p>
          <h2 className="mt-2 text-xl font-medium">{mode === "signin" ? "Entrar no Orbit" : "Criar sua conta"}</h2>

          <Button variant="outline" className="mt-6 w-full" onClick={google}>
            Continuar com Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou e-mail <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={160} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                maxLength={72}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <button
            className="mt-5 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Não tem conta? Criar agora" : "Já tenho conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
