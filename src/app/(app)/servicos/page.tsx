"use client";
import { getErrorMessage } from "@/lib/errors";

import { useMemo, useState } from "react";
import { Clock3, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input,
  LoadingState, Modal, PageHeader, SearchInput, StatusBadge, Textarea, Toggle,
} from "@/components/ui";
import { useCrudTable } from "@/hooks/use-crud-table";
import { formatCurrency, formatDuration } from "@/lib/datetime";
import { getSupabase } from "@/lib/supabase";
import type { Barber, Service } from "@/lib/types";

export default function ServicosPage() {
  const { rows, loading, error, insert, update, remove, reload } = useCrudTable<Service>("services");
  const barbers = useCrudTable<Barber>("barbers");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [allowedBarbers, setAllowedBarbers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "0", duration: "30", active: true });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? rows.filter((s) => s.name.toLowerCase().includes(term) || s.description?.toLowerCase().includes(term)) : rows;
  }, [rows, search]);

  const openForm = async (service?: Service) => {
    setEditing(service ?? null);
    setFormError(null);
    setForm({
      name: service?.name ?? "",
      description: service?.description ?? "",
      price: String(service?.price ?? 0),
      duration: String(service?.duration_minutes ?? 30),
      active: service?.active ?? true,
    });
    if (service) {
      const { data } = await getSupabase().from("service_barbers").select("barber_id").eq("service_id", service.id);
      setAllowedBarbers((data ?? []).map((r) => r.barber_id as string));
    } else {
      setAllowedBarbers([]);
    }
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const values = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price) || 0,
        duration_minutes: Math.max(15, Number(form.duration) || 30),
        active: form.active,
      };
      const saved = editing ? await update(editing.id, values).then(() => editing) : await insert(values);
      const supabase = getSupabase();
      const { error: delError } = await supabase.from("service_barbers").delete().eq("service_id", saved.id);
      if (delError) throw delError;
      if (allowedBarbers.length) {
        const { error } = await supabase.from("service_barbers").insert(
          allowedBarbers.map((barber_id) => ({ service_id: saved.id, barber_id }))
        );
        if (error) throw error;
      }
      await reload();
      setOpen(false);
    } catch (err) {
      setFormError(getErrorMessage(err, "Erro ao salvar serviço."));
    } finally {
      setBusy(false);
    }
  };

  const removeService = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await remove(deleting.id);
      setDeleting(null);
    } catch (err) {
      setFormError(getErrorMessage(err, "Erro ao excluir serviço."));
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
        title="Serviços"
        subtitle="Crie serviços personalizados com preço e duração informativos."
        action={<Button variant="primary" onClick={() => void openForm()}><Plus size={16} /> Novo serviço</Button>}
      />
      {error && <ErrorState message={error} />}
      {formError && !open && <ErrorState message={formError} />}

      <Card className="mb-4 p-3 sm:p-4"><SearchInput value={search} onChange={setSearch} placeholder="Buscar serviço..." /></Card>

      {loading ? <Card><LoadingState /></Card> : filtered.length === 0 ? (
        <Card><EmptyState title="Nenhum serviço cadastrado" message="Crie serviços como cabelo, barba ou degradê." icon={<Scissors size={22} />} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white">{s.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{s.description || "Sem descrição"}</p>
                </div>
                <div className="flex gap-1">
                  <IconButton label="Editar" onClick={() => void openForm(s)}><Pencil size={15} /></IconButton>
                  <IconButton label="Excluir" onClick={() => setDeleting(s)} className="hover:text-rose-300"><Trash2 size={15} /></IconButton>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">Preço informativo</p>
                  <p className="mt-0.5 text-lg font-semibold text-gold-200">{formatCurrency(s.price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">Duração</p>
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-sm text-slate-300"><Clock3 size={13} /> {formatDuration(s.duration_minutes)}</p>
                </div>
              </div>
              <div className="mt-3">
                <StatusBadge label={s.active ? "Ativo" : "Inativo"} style={s.active ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" : "bg-slate-500/10 text-slate-400 border-slate-500/25"} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar serviço" : "Novo serviço"}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Degradê" required /></Field>
          <Field label="Descrição"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes do serviço" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preço informativo (R$)"><Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="Duração (minutos)"><Input type="number" min="15" step="5" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></Field>
          </div>
          <Field label="Barbeiros habilitados">
            <div className="grid gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-2">
              {barbers.rows.length === 0 && <p className="text-xs text-slate-500">Cadastre barbeiros para definir as permissões.</p>}
              {barbers.rows.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={allowedBarbers.includes(b.id)}
                    onChange={(e) => setAllowedBarbers(e.target.checked ? [...allowedBarbers, b.id] : allowedBarbers.filter((id) => id !== b.id))}
                    className="h-4 w-4 accent-[#c99a3d]"
                  />
                  {b.name}
                </label>
              ))}
            </div>
          </Field>
          <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Serviço ativo" />
          {formError && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={busy}>Salvar serviço</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir serviço?"
        message={`${deleting?.name ?? ""} será removido. Serviços usados em agendamentos ou planos não podem ser excluídos.`}
        confirmLabel="Excluir"
        danger
        loading={busy}
        onConfirm={() => void removeService()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
