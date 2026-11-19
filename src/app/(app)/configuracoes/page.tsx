"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, Code2, ImageIcon, MapPin, MessageCircle, Scissors, Store } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, ErrorState, Field, Input, PageHeader, SectionTitle, Toggle } from "@/components/ui";
import { WEEKDAY_LABELS } from "@/lib/datetime";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, type Barbershop, type OpeningHour, type ShopSettings } from "@/lib/types";

export default function ConfiguracoesPage() {
  const { shop, refresh } = useAuth();
  const [form, setForm] = useState({
    name: "", logo_url: "", address: "", whatsapp: "",
  });
  const [hours, setHours] = useState<OpeningHour[]>([]);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shop) return;
    setForm({
      name: shop.name,
      logo_url: shop.logo_url ?? "",
      address: shop.address ?? "",
      whatsapp: shop.whatsapp ?? "",
    });
    setHours(WEEKDAY_LABELS.map((_, day) => {
      const found = shop.hours?.find((h) => h.day === day);
      return found ?? { day, open: "09:00", close: "19:00", closed: day === 0 };
    }));
    setSettings({ ...DEFAULT_SETTINGS, ...shop.settings });
  }, [shop]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await getSupabase()
        .from("barbershops")
        .update({
          name: form.name.trim(),
          logo_url: form.logo_url.trim() || null,
          address: form.address.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          hours,
          settings,
        })
        .eq("id", shop.id);
      if (error) throw error;
      await refresh();
      setMessage("Configurações salvas com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configurações.");
    } finally {
      setBusy(false);
    }
  };

  const updateHour = (day: number, values: Partial<OpeningHour>) => {
    setHours((current) => current.map((h) => (h.day === day ? { ...h, ...values } : h)));
  };

  const apiBase = typeof window !== "undefined"
    ? `${window.location.origin}/api/public/v1`
    : "/api/public/v1";

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Dados da barbearia, expediente, preferências e integração."
      />
      {message && <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">{message}</div>}
      {error && <ErrorState message={error} />}

      <form onSubmit={save} className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <SectionTitle hint="Identidade usada no painel e futuras integrações.">Dados da barbearia</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome da barbearia"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
              <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" /></Field>
              <div className="sm:col-span-2">
                <Field label="Endereço"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade" /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Logotipo (URL)"><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></Field>
                {form.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo_url} alt="Prévia do logotipo" className="mt-3 h-16 w-16 rounded-xl border border-white/10 object-contain p-1" />
                )}
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle hint="Define o expediente geral. A jornada individual de cada barbeiro é configurada no cadastro dele.">Horários de funcionamento</SectionTitle>
            <div className="space-y-2">
              {hours.map((h) => (
                <div key={h.day} className="grid grid-cols-[110px_1fr_1fr_60px] items-center gap-2 rounded-lg bg-white/[0.02] px-3 py-2">
                  <span className="text-xs text-slate-400">{WEEKDAY_LABELS[h.day].replace("-feira", "")}</span>
                  <Input type="time" disabled={h.closed} value={h.open} onChange={(e) => updateHour(h.day, { open: e.target.value })} className="py-1.5 text-xs" />
                  <Input type="time" disabled={h.closed} value={h.close} onChange={(e) => updateHour(h.day, { close: e.target.value })} className="py-1.5 text-xs" />
                  <label className="flex items-center gap-1 text-[11px] text-slate-500">
                    <input type="checkbox" checked={h.closed} onChange={(e) => updateHour(h.day, { closed: e.target.checked })} className="h-3.5 w-3.5 accent-[#c99a3d]" /> Fechado
                  </label>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle hint="Regras aplicadas ao criar agendamentos no painel e pela API pública.">Preferências de agendamento</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Intervalo dos horários (minutos)"><Input type="number" min="15" step="5" value={settings.slot_interval} onChange={(e) => setSettings({ ...settings, slot_interval: Math.max(15, Number(e.target.value)) })} /></Field>
              <Field label="Antecedência mínima (minutos)"><Input type="number" min="0" step="15" value={settings.lead_time_minutes} onChange={(e) => setSettings({ ...settings, lead_time_minutes: Math.max(0, Number(e.target.value)) })} /></Field>
              <Field label="Cancelamento mínimo (horas)"><Input type="number" min="0" value={settings.cancel_hours} onChange={(e) => setSettings({ ...settings, cancel_hours: Math.max(0, Number(e.target.value)) })} /></Field>
              <Field label="Limite de agendamento (dias)"><Input type="number" min="1" value={settings.max_days_ahead} onChange={(e) => setSettings({ ...settings, max_days_ahead: Math.max(1, Number(e.target.value)) })} /></Field>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="submit" variant="primary" loading={busy}>Salvar configurações</Button>
          </div>
        </div>

        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <SectionTitle>Painel</SectionTitle>
            <div className="space-y-2">
              <Link href="/barbeiros" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-slate-300 transition hover:border-gold-400/30">
                <span className="flex items-center gap-2"><Scissors size={15} className="text-gold-300" /> Configurar barbeiros</span>
                <ArrowUpRight size={14} />
              </Link>
              <Link href="/servicos" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-slate-300 transition hover:border-gold-400/30">
                <span className="flex items-center gap-2"><Store size={15} className="text-gold-300" /> Serviços e planos</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-xs text-slate-500">
              <p className="flex items-center gap-2"><MapPin size={13} /> {shop?.address || "Endereço não informado"}</p>
              <p className="flex items-center gap-2"><MessageCircle size={13} /> {shop?.whatsapp || "WhatsApp não informado"}</p>
              <p className="flex items-center gap-2"><Clock3 size={13} /> {hours.filter((h) => !h.closed).length} dias operantes</p>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle hint="Base para sites externos consultarem dados e criarem agendamentos.">API pública</SectionTitle>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Base URL</p>
                <code className="mt-1 block break-all rounded-lg bg-ink-900 p-2.5 text-[11px] text-gold-200">{apiBase}</code>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-400">
                <p><span className="font-semibold text-emerald-300">GET</span> /services?shopId=...</p>
                <p><span className="font-semibold text-emerald-300">GET</span> /barbers?shopId=...</p>
                <p><span className="font-semibold text-emerald-300">GET</span> /availability?shopId=...&barberId=...&serviceId=...&date=...</p>
                <p><span className="font-semibold text-sky-300">POST</span> /appointments</p>
                <p><span className="font-semibold text-rose-300">POST</span> /appointments/cancel</p>
              </div>
              <p className="rounded-lg border border-gold-400/15 bg-gold-400/[0.04] p-3 text-[11px] leading-relaxed text-slate-400">
                Envie a chave anônima do Supabase no cabeçalho <code className="text-gold-200">apikey</code>. A validação de disponibilidade e conflitos é feita no servidor.
              </p>
              <p className="flex items-center gap-2 text-[11px] text-slate-600"><Code2 size={13} /> Documentação completa no README.md</p>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
