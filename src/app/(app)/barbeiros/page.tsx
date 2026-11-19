"use client";
import { getErrorMessage } from "@/lib/errors";

import { useMemo, useState } from "react";
import { CalendarClock, ImageIcon, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import clsx from "clsx";
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input,
  LoadingState, Modal, PageHeader, SearchInput, Select, StatusBadge, Textarea, Toggle,
} from "@/components/ui";
import { useCrudTable } from "@/hooks/use-crud-table";
import { WEEKDAY_LABELS, WEEKDAY_SHORT, timeToMinutes } from "@/lib/datetime";
import { getSupabase } from "@/lib/supabase";
import type { Barber, BarberSchedule, BreakInterval, Service, ServiceBarber } from "@/lib/types";

interface ScheduleDraft {
  weekday: number;
  start_time: string;
  end_time: string;
  is_day_off: boolean;
}

const emptySchedule = (): ScheduleDraft[] =>
  WEEKDAY_LABELS.map((_, weekday) => ({
    weekday,
    start_time: weekday === 0 ? "09:00" : "09:00",
    end_time: weekday === 0 ? "18:00" : weekday === 6 ? "14:00" : "19:00",
    is_day_off: weekday === 0,
  }));

export default function BarbeirosPage() {
  const { rows, loading, error, insert, update, remove, reload } = useCrudTable<Barber>("barbers");
  const services = useCrudTable<Service>("services");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [schedules, setSchedules] = useState<BarberSchedule[]>([]);
  const [allowedServices, setAllowedServices] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<Barber | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", whatsapp: "", photo_url: "", bio: "", specialties: "", active: true,
  });
  const [draftSchedule, setDraftSchedule] = useState<ScheduleDraft[]>(emptySchedule());
  const [breaks, setBreaks] = useState<BreakInterval[]>([]);
  const [newBreak, setNewBreak] = useState({ start: "12:00", end: "13:00" });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? rows.filter((b) => [b.name, b.phone, b.specialties.join(" ")].some((v) => v?.toLowerCase().includes(term))) : rows;
  }, [rows, search]);

  const loadRelations = async (barberId: string) => {
    const supabase = getSupabase();
    const [sched, allowed] = await Promise.all([
      supabase.from("barber_schedules").select("*").eq("barber_id", barberId),
      supabase.from("service_barbers").select("service_id").eq("barber_id", barberId),
    ]);
    setSchedules((sched.data ?? []) as BarberSchedule[]);
    setAllowedServices((allowed.data ?? []).map((r) => r.service_id as string));
  };

  const openForm = async (barber?: Barber) => {
    setEditing(barber ?? null);
    setFormError(null);
    setBreaks(barber?.breaks ?? []);
    if (barber) {
      setForm({
        name: barber.name, phone: barber.phone ?? "", whatsapp: barber.whatsapp ?? "",
        photo_url: barber.photo_url ?? "", bio: barber.bio ?? "",
        specialties: barber.specialties.join(", "), active: barber.active,
      });
      await loadRelations(barber.id);
    } else {
      setForm({ name: "", phone: "", whatsapp: "", photo_url: "", bio: "", specialties: "", active: true });
      setSchedules([]);
      setAllowedServices([]);
      setDraftSchedule(emptySchedule());
    }
    setOpen(true);
  };

  const effectiveSchedule = editing ? (schedules.length ? schedules.map((s) => ({
    weekday: s.weekday,
    start_time: s.start_time ?? "09:00",
    end_time: s.end_time ?? "19:00",
    is_day_off: s.is_day_off,
  })) : emptySchedule()) : draftSchedule;

  const updateSchedule = (weekday: number, values: Partial<ScheduleDraft>) => {
    const base = effectiveSchedule.map((s) => ({ ...s }));
    const index = base.findIndex((s) => s.weekday === weekday);
    if (index >= 0) base[index] = { ...base[index], ...values };
    else base.push({ weekday, start_time: "09:00", end_time: "19:00", is_day_off: false, ...values });
    if (editing) setSchedules(base as BarberSchedule[]);
    else setDraftSchedule(base);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const values = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        photo_url: form.photo_url.trim() || null,
        bio: form.bio.trim() || null,
        specialties: form.specialties.split(",").map((s) => s.trim()).filter(Boolean),
        active: form.active,
        breaks,
      };
      const saved = editing ? await update(editing.id, values).then(() => editing) : await insert(values);
      const supabase = getSupabase();

      const { error: schedError } = await supabase.from("barber_schedules").delete().eq("barber_id", saved.id);
      if (schedError) throw schedError;
      const schedulePayload = effectiveSchedule.map((s) => ({
        barber_id: saved.id,
        weekday: s.weekday,
        start_time: s.is_day_off ? null : s.start_time,
        end_time: s.is_day_off ? null : s.end_time,
        is_day_off: s.is_day_off,
      }));
      if (schedulePayload.length) {
        const { error } = await supabase.from("barber_schedules").insert(schedulePayload);
        if (error) throw error;
      }

      const { error: allowedError } = await supabase.from("service_barbers").delete().eq("barber_id", saved.id);
      if (allowedError) throw allowedError;
      if (allowedServices.length) {
        const { error } = await supabase.from("service_barbers").insert(
          allowedServices.map((service_id) => ({ barber_id: saved.id, service_id }))
        );
        if (error) throw error;
      }
      await reload();
      setOpen(false);
    } catch (err) {
      setFormError(getErrorMessage(err, "Erro ao salvar barbeiro."));
    } finally {
      setBusy(false);
    }
  };

  const removeBarber = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await remove(deleting.id);
      setDeleting(null);
    } catch (err) {
      setFormError(getErrorMessage(err, "Erro ao excluir barbeiro."));
      setDeleting(null);
      setOpen(true);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Barbeiros"
        subtitle="Equipe, especialidades, jornada e serviços permitidos."
        action={<Button variant="primary" onClick={() => void openForm()}><Plus size={16} /> Novo barbeiro</Button>}
      />
      {error && <ErrorState message={error} />}
      {formError && !open && <ErrorState message={formError} />}

      <Card className="mb-4 p-3 sm:p-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar barbeiro..." />
      </Card>

      {loading ? <Card><LoadingState /></Card> : filtered.length === 0 ? (
        <Card><EmptyState title="Nenhum barbeiro cadastrado" message="Cadastre a equipe para começar a distribuir os atendimentos." icon={<Scissors size={22} />} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-start gap-4">
                {b.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.photo_url} alt={b.name} className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-gold-400/20 bg-gold-400/10 text-lg font-bold text-gold-200">
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-white">{b.name}</h3>
                    <StatusBadge label={b.active ? "Ativo" : "Inativo"} style={b.active ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" : "bg-slate-500/10 text-slate-400 border-slate-500/25"} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{b.phone || "Sem telefone"}</p>
                </div>
                <div className="flex gap-1">
                  <IconButton label="Editar" onClick={() => void openForm(b)}><Pencil size={15} /></IconButton>
                  <IconButton label="Excluir" onClick={() => setDeleting(b)} className="hover:text-rose-300"><Trash2 size={15} /></IconButton>
                </div>
              </div>
              {b.specialties.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {b.specialties.map((s) => <span key={s} className="rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-slate-400">{s}</span>)}
                </div>
              )}
              {b.bio && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500">{b.bio}</p>}
              <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-slate-600">
                <CalendarClock size={13} /> {b.breaks.length ? `${b.breaks.length} intervalo(s)` : "Sem intervalos"}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} wide title={editing ? "Editar barbeiro" : "Novo barbeiro"} subtitle="Jornada e folgas são aplicadas ao calcular horários.">
        <form onSubmit={save} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Nome do barbeiro" /></Field>
            <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 3333-3333" /></Field>
            <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" /></Field>
            <Field label="Foto (URL)"><Input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="https://..." /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Especialidades" hint="Separe por vírgulas"><Input value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} placeholder="Degradê, barba, cabelo" /></Field>
            <div className="flex items-end pb-2"><Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Barbeiro ativo" /></div>
          </div>
          <Field label="Biografia"><Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Breve descrição do profissional" /></Field>

          <div>
            <p className="label">Serviços permitidos</p>
            <div className="grid gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-2">
              {services.rows.length === 0 && <p className="text-xs text-slate-500">Cadastre serviços para definir as permissões.</p>}
              {services.rows.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={allowedServices.includes(s.id)}
                    onChange={(e) => setAllowedServices(e.target.checked ? [...allowedServices, s.id] : allowedServices.filter((id) => id !== s.id))}
                    className="h-4 w-4 accent-[#c99a3d]"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Horários de trabalho</p>
            <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              {effectiveSchedule.map((s) => (
                <div key={s.weekday} className="grid grid-cols-[110px_1fr_1fr_70px] items-center gap-2">
                  <span className="text-xs text-slate-400">{WEEKDAY_LABELS[s.weekday].replace("-feira", "")}</span>
                  <Input type="time" disabled={s.is_day_off} value={s.start_time ?? "09:00"} onChange={(e) => updateSchedule(s.weekday, { start_time: e.target.value })} className="py-1.5 text-xs" />
                  <Input type="time" disabled={s.is_day_off} value={s.end_time ?? "19:00"} onChange={(e) => updateSchedule(s.weekday, { end_time: e.target.value })} className="py-1.5 text-xs" />
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <input type="checkbox" checked={s.is_day_off} onChange={(e) => updateSchedule(s.weekday, { is_day_off: e.target.checked })} className="h-3.5 w-3.5 accent-[#c99a3d]" />
                    Folga
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="label">Intervalos (pausas)</p>
            <div className="space-y-2">
              {breaks.map((br, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                  <span>{br.start} — {br.end}</span>
                  <button type="button" onClick={() => setBreaks(breaks.filter((_, index) => index !== i))} className="ml-auto text-rose-300 hover:text-rose-200">remover</button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input type="time" value={newBreak.start} onChange={(e) => setNewBreak({ ...newBreak, start: e.target.value })} className="w-32" />
                <Input type="time" value={newBreak.end} onChange={(e) => setNewBreak({ ...newBreak, end: e.target.value })} className="w-32" />
                <Button type="button" onClick={() => {
                  if (timeToMinutes(newBreak.end) > timeToMinutes(newBreak.start)) setBreaks([...breaks, newBreak]);
                }}><Plus size={14} /> Adicionar</Button>
              </div>
            </div>
          </div>

          {formError && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={busy}>Salvar barbeiro</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir barbeiro?"
        message={`${deleting?.name ?? ""} será removido. Agendamentos vinculados impedem a exclusão.`}
        confirmLabel="Excluir"
        danger
        loading={busy}
        onConfirm={() => void removeBarber()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
