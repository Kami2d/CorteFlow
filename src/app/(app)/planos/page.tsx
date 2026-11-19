"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Layers3, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input,
  LoadingState, Modal, PageHeader, SearchInput, Textarea, Toggle,
} from "@/components/ui";
import { useCrudTable } from "@/hooks/use-crud-table";
import { formatCurrency, formatDuration } from "@/lib/datetime";
import { getSupabase } from "@/lib/supabase";
import type { Service, ServicePlan, ServicePlanItem } from "@/lib/types";

export default function PlanosPage() {
  const plans = useCrudTable<ServicePlan>("service_plans");
  const services = useCrudTable<Service>("services");
  const [items, setItems] = useState<ServicePlanItem[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServicePlan | null>(null);
  const [deleting, setDeleting] = useState<ServicePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "0", active: true });
  const [selected, setSelected] = useState<string[]>([]);

  const loadItems = async () => {
    const { data } = await getSupabase().from("service_plan_items").select("id,plan_id,service_id");
    setItems((data ?? []) as ServicePlanItem[]);
  };

  useEffect(() => { void loadItems(); }, [plans.rows.length]);

  const totalDuration = services.rows
    .filter((s) => selected.includes(s.id))
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? plans.rows.filter((p) => p.name.toLowerCase().includes(term)) : plans.rows;
  }, [plans.rows, search]);

  const openForm = async (plan?: ServicePlan) => {
    setEditing(plan ?? null);
    setFormError(null);
    setForm({
      name: plan?.name ?? "",
      description: plan?.description ?? "",
      price: String(plan?.price ?? 0),
      active: plan?.active ?? true,
    });
    if (plan) {
      const { data } = await getSupabase().from("service_plan_items").select("service_id").eq("plan_id", plan.id);
      setSelected((data ?? []).map((r) => r.service_id as string));
    } else {
      setSelected([]);
    }
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      if (selected.length === 0) throw new Error("Selecione pelo menos um serviço para o plano.");
      const values = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price) || 0,
        duration_minutes: totalDuration,
        active: form.active,
      };
      const saved = editing ? await plans.update(editing.id, values).then(() => editing) : await plans.insert(values);
      const supabase = getSupabase();
      const { error: delError } = await supabase.from("service_plan_items").delete().eq("plan_id", saved.id);
      if (delError) throw delError;
      const { error } = await supabase.from("service_plan_items").insert(
        selected.map((service_id) => ({ plan_id: saved.id, service_id }))
      );
      if (error) throw error;
      await loadItems();
      await plans.reload();
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar plano.");
    } finally {
      setBusy(false);
    }
  };

  const removePlan = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await plans.remove(deleting.id);
      setDeleting(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao excluir plano.");
      setDeleting(null);
      setOpen(true);
      await plans.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Planos de atendimento"
        subtitle="Pacotes com duração calculada automaticamente e preço promocional."
        action={<Button variant="primary" onClick={() => void openForm()}><Plus size={16} /> Novo plano</Button>}
      />
      {plans.error && <ErrorState message={plans.error} />}
      {formError && !open && <ErrorState message={formError} />}

      <Card className="mb-4 p-3 sm:p-4"><SearchInput value={search} onChange={setSearch} placeholder="Buscar plano..." /></Card>

      {plans.loading ? <Card><LoadingState /></Card> : filtered.length === 0 ? (
        <Card><EmptyState title="Nenhum plano criado" message="Combine serviços como Cabelo + Barba em um pacote." icon={<Layers3 size={22} />} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const planServices = services.rows.filter((s) => items.some((i) => i.plan_id === p.id && i.service_id === s.id));
            const sum = planServices.reduce((acc, s) => acc + s.price, 0);
            return (
              <Card key={p.id} className="relative overflow-hidden p-5">
                <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-gold-400/[0.05] blur-2xl" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">{p.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{p.description || "Sem descrição"}</p>
                  </div>
                  <div className="flex gap-1">
                    <IconButton label="Editar" onClick={() => void openForm(p)}><Pencil size={15} /></IconButton>
                    <IconButton label="Excluir" onClick={() => setDeleting(p)} className="hover:text-rose-300"><Trash2 size={15} /></IconButton>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {planServices.map((s) => <span key={s.id} className="rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-slate-400">{s.name}</span>)}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">Duração total</p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-200"><Clock3 size={13} className="text-gold-300" /> {formatDuration(p.duration_minutes)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">Preço do plano</p>
                    <p className="mt-0.5 text-lg font-semibold text-gold-200">{formatCurrency(p.price)}</p>
                  </div>
                </div>
                {sum > p.price && (
                  <p className="mt-2 text-[11px] text-emerald-300">Promoção: economia de {formatCurrency(sum - p.price)} em relação aos serviços avulsos.</p>
                )}
                {!p.active && <p className="mt-2 text-[11px] text-slate-500">Plano inativo</p>}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar plano" : "Novo plano"} subtitle="A duração é a soma dos serviços incluídos.">
        <form onSubmit={save} className="space-y-4">
          <Field label="Nome do plano"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Cabelo + Barba" required /></Field>
          <Field label="Descrição"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva o pacote" /></Field>
          <Field label="Serviços incluídos">
            <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              {services.rows.length === 0 && <p className="text-xs text-slate-500">Cadastre serviços antes de criar planos.</p>}
              {services.rows.map((s) => (
                <label key={s.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5 text-xs text-slate-300 hover:bg-white/[0.03]">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, s.id] : selected.filter((id) => id !== s.id))}
                    className="h-4 w-4 accent-[#c99a3d]"
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-slate-500">{formatDuration(s.duration_minutes)} · {formatCurrency(s.price)}</span>
                </label>
              ))}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-gold-400/15 bg-gold-400/[0.04] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Duração total calculada</p>
              <p className="mt-1 text-sm font-semibold text-gold-200">{formatDuration(totalDuration)}</p>
            </div>
            <Field label="Preço promocional (R$)">
              <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
          </div>
          <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Plano ativo" />
          {formError && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={busy}>Salvar plano</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir plano?"
        message={`${deleting?.name ?? ""} será removido. Planos com agendamentos vinculados não podem ser excluídos.`}
        confirmLabel="Excluir"
        danger
        loading={busy}
        onConfirm={() => void removePlan()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
