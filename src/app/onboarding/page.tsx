"use client";
import { getErrorMessage } from "@/lib/errors";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, ErrorDebug, Field, Input } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";

export default function OnboardingPage() {
  const router = useRouter();
  const { loading, session, needsOnboarding, refresh, signOut } = useAuth();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<unknown>(null);

  useEffect(() => {
    if (!loading && (!session || !needsOnboarding)) router.replace("/login");
  }, [loading, session, needsOnboarding, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setErrorDetails(null);
    try {
      const { data, error } = await getSupabase().rpc("create_barbershop_for_current_user", {
        p_name: name.trim(),
        p_address: address.trim() || null,
        p_whatsapp: whatsapp.trim() || null,
        p_logo_url: null,
      });
      if (error) throw error;
      if (!data) throw new Error("Não foi possível criar a barbearia.");
      await refresh();
      router.replace("/dashboard");
    } catch (err) {
      console.error("[CorteFlow] falha ao criar barbearia", err);
      setErrorDetails(err);
      const message = getErrorMessage(err, "Erro ao criar barbearia.");
      setError(
        /schema cache|could not find the function/i.test(message)
          ? "A RPC de onboarding ainda não está no cache do Supabase. Execute o arquivo supabase/migrations/0002_reload_schema_cache.sql no SQL Editor e tente novamente."
          : message
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-5">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-200 to-gold-500 text-ink-950">
            <Scissors size={21} />
          </div>
          <div>
            <p className="text-lg font-bold text-white">CorteFlow</p>
            <p className="text-[11px] uppercase tracking-widest text-gold-300/70">Quase lá</p>
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-white">Configure sua barbearia</h1>
        <p className="mt-2 text-sm text-slate-500">
          Esses dados aparecem no painel e podem ser alterados depois em Configurações.
        </p>
        <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
          <Field label="Nome da barbearia">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Corteflow Barbearia" required />
          </Field>
          <Field label="Endereço (opcional)">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" />
          </Field>
          <Field label="WhatsApp (opcional)">
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
          </Field>
          {error && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
              <p>{error}</p>
              {errorDetails !== null && <ErrorDebug error={errorDetails} />}
            </div>
          )}
          <Button type="submit" variant="primary" className="w-full" loading={busy}>
            Criar barbearia e entrar
          </Button>
          <button type="button" onClick={() => void signOut()} className="w-full text-center text-xs text-slate-500 hover:text-slate-300">
            Sair da conta
          </button>
        </form>
      </div>
    </div>
  );
}
