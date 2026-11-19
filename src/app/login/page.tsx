"use client";
import { getErrorMessage } from "@/lib/errors";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, Scissors, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, ErrorDebug, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { loading, configured, session, needsOnboarding, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<unknown>(null);

  useEffect(() => {
    if (loading) return;
    if (session) router.replace(needsOnboarding ? "/onboarding" : "/dashboard");
  }, [loading, session, needsOnboarding, router]);

  if (!configured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
        <div className="card max-w-md p-8 text-center">
          <p className="text-sm text-slate-300">Configure o Supabase para continuar.</p>
          <Link href="/setup" className="btn-primary mt-5 inline-flex">Ver instruções</Link>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrorDetails(null);
    setMessage(null);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password, name);
        setMessage(result.message);
      }
    } catch (err) {
      console.error("[CorteFlow] falha de autenticação", err);
      setErrorDetails(err);
      setError(getErrorMessage(err, "Não foi possível entrar."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-ink-950 lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-gradient-to-br from-ink-850 via-ink-900 to-ink-950 p-12 lg:flex">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold-400/[0.07] blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-gold-600/[0.06] blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-200 to-gold-500 text-ink-950 shadow-gold">
            <Scissors size={22} strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-lg font-bold text-white">CorteFlow</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-gold-300/70">Gestão de barbearia</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            Sua barbearia, <span className="text-gold-300">sob controle.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Agendamentos, equipe, clientes e serviços organizados em um painel feito para o ritmo do seu negócio.
          </p>
          <div className="mt-8 space-y-3">
            {["Agenda com conflitos bloqueados", "Jornada individual de cada barbeiro", "Acesso de qualquer dispositivo"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-300">
                <ShieldCheck size={16} className="text-gold-300" /> {item}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-600">© CorteFlow · MVP Web</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold-200 to-gold-500 text-ink-950">
              <Scissors size={20} />
            </div>
            <span className="text-lg font-bold text-white">CorteFlow</span>
          </div>
          <h2 className="text-2xl font-semibold text-white">
            {mode === "login" ? "Bem-vindo de volta" : "Criar conta"}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {mode === "login" ? "Entre para acessar o painel da sua barbearia." : "Comece a organizar sua barbearia."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === "signup" && (
              <Field label="Seu nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do gerente" required />
              </Field>
            )}
            <Field label="E-mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@barbearia.com" required autoComplete="email" />
            </Field>
            <Field label="Senha">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </Field>
            {error && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                <p>{error}</p>
                {errorDetails !== null && <ErrorDebug error={errorDetails} />}
              </div>
            )}
            {message && <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">{message}</p>}
            <Button type="submit" variant="primary" className="w-full" loading={busy}>
              {mode === "login" ? "Entrar no painel" : "Criar minha conta"}
              {!busy && <ArrowRight size={16} />}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setMessage(null); }}
            className="mt-6 w-full text-center text-xs text-slate-500 transition hover:text-gold-200"
          >
            {mode === "login" ? "Ainda não tem conta? Cadastre-se" : "Já tem conta? Entre"}
          </button>

          <div className="mt-8 flex items-center justify-center gap-2 border-t border-white/[0.06] pt-6 text-[11px] text-slate-600">
            <LockKeyhole size={12} /> Acesso restrito à equipe da barbearia
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-600">
            <Mail size={11} className="mr-1 inline" /> A API pública para sites externos não requer login.
          </p>
        </div>
      </div>
    </div>
  );
}
