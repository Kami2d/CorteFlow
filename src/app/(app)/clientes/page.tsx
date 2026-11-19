"use client";
import { getErrorMessage } from "@/lib/errors";

import { useMemo, useState } from "react";
import { CalendarDays, MessageCircle, Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import {
  Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input,
  LoadingState, Modal, PageHeader, SearchInput, StatusBadge, Textarea,
} from "@/components/ui";
import { useCrudTable } from "@/hooks/use-crud-table";
import { useAppointments } from "@/hooks/use-appointments";
import { formatDateTime, formatCurrency } from "@/lib/datetime";
import { STATUS_LABEL, STATUS_STYLE, type Client } from "@/lib/types";

export default function ClientesPage() {
  const { rows, loading, error, insert, update, remove } = useCrudTable<Client>("clients");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [history, setHistory] = useState<Client | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", notes: "" });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((c) =>
      [c.name, c.phone, c.whatsapp, c.notes].some((v) => v?.toLowerCase().includes(term))
    );
  }, [rows, search]);

  const openForm = (client?: Client) => {
    setEditing(client ?? null);
    setForm({
      name: client?.name ?? "",
      phone: client?.phone ?? "",
      whatsapp: client?.whatsapp ?? "",
      notes: client?.notes ?? "",
    });
    setFormError(null);
    setOpen(true);
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
        notes: form.notes.trim() || null,
      };
      if (editing) await update(editing.id, values);
      else await insert(values);
      setOpen(false);
    } catch (err) {
      setFormError(getErrorMessage(err, "Erro ao salvar cliente."));
    } finally {
      setBusy(false);
    }
  };

  const removeClient = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await remove(deleting.id);
      setDeleting(null);
    } catch (err) {
      setFormError(getErrorMessage(err, "Não foi possível excluir o cliente."));
      setDeleting(null);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Cadastros, contatos e histórico de atendimentos."
        action={<Button variant="primary" onClick={() => openForm()}><Plus size={16} /> Novo cliente</Button>}
      />
      {error && <ErrorState message={error} />}
      {formError && !open && <ErrorState message={formError} />}

      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome ou telefone..." />
          <p className="text-xs text-slate-500">{filtered.length} cliente{filtered.length === 1 ? "" : "s"}</p>
        </div>
      </Card>

      {loading ? (
        <Card><LoadingState /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum cliente encontrado" message="Cadastre um cliente para começar a criar agendamentos." icon={<Users size={22} />} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="table-wrap">
            <table className="w-full">
              <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                <tr>
                  <th className="th">Cliente</th>
                  <th className="th">Telefone</th>
                  <th className="th">WhatsApp</th>
                  <th className="th">Observações</th>
                  <th className="th text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition hover:bg-white/[0.02]">
                    <td className="td">
                      <button onClick={() => setHistory(c)} className="font-medium text-slate-100 hover:text-gold-200">{c.name}</button>
                    </td>
                    <td className="td">{c.phone || <span className="text-slate-600">—</span>}</td>
                    <td className="td">{c.whatsapp || <span className="text-slate-600">—</span>}</td>
                    <td className="td max-w-[280px] truncate">{c.notes || <span className="text-slate-600">—</span>}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <IconButton label="Histórico" onClick={() => setHistory(c)}><CalendarDays size={16} /></IconButton>
                        <IconButton label="Editar" onClick={() => openForm(c)}><Pencil size={16} /></IconButton>
                        <IconButton label="Excluir" onClick={() => setDeleting(c)} className="hover:text-rose-300"><Trash2 size={16} /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar cliente" : "Novo cliente"}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 3333-3333" /></Field>
            <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(11) 99999-9999" /></Field>
          </div>
          <Field label="Observações"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Preferências, histórico, alergias..." /></Field>
          {formError && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={busy}>Salvar</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir cliente?"
        message={`${deleting?.name ?? ""} será removido do cadastro. Clientes com agendamentos vinculados não podem ser excluídos.`}
        confirmLabel="Excluir"
        danger
        loading={busy}
        onConfirm={() => void removeClient()}
        onClose={() => setDeleting(null)}
      />

      {history && <ClientHistory client={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function ClientHistory({ client, onClose }: { client: Client; onClose: () => void }) {
  const { rows, loading } = useAppointments();
  const history = rows
    .filter((a) => a.client_id === client.id)
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());

  const whatsappLink = client.whatsapp
    ? `https://wa.me/${client.whatsapp.replace(/\D/g, "")}`
    : null;

  return (
    <Modal open onClose={onClose} title={client.name} subtitle="Histórico de agendamentos">
      <div className="mb-5 flex flex-wrap gap-2">
        {client.phone && (
          <a href={`tel:${client.phone}`} className="btn-secondary text-xs"><Phone size={14} /> {client.phone}</a>
        )}
        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noreferrer" className="btn-secondary text-xs"><MessageCircle size={14} /> WhatsApp</a>
        )}
      </div>
      {client.notes && (
        <div className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-400">
          <span className="font-semibold text-slate-300">Observações:</span> {client.notes}
        </div>
      )}
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Atendimentos</h3>
      {loading ? <LoadingState /> : history.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">Nenhum agendamento registrado.</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {history.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">{a.service?.name ?? a.plan?.name ?? "Atendimento"}</p>
                <p className="text-[11px] text-slate-500">{formatDateTime(a.start_at)} · {a.barber?.name ?? "—"}</p>
              </div>
              <div className="text-right">
                <StatusBadge label={STATUS_LABEL[a.status]} style={STATUS_STYLE[a.status]} />
                <p className="mt-1 text-[11px] text-slate-500">{formatCurrency((a.service?.price ?? a.plan?.price) ?? 0)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
