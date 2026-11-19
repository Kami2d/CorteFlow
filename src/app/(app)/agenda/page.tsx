"use client";
import { getErrorMessage } from "@/lib/errors";

import { useEffect, useMemo, useState } from "react";
import { addDays, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListFilter,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/components/auth-provider";
import { AppointmentForm } from "@/components/appointment-form";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { useAppointments } from "@/hooks/use-appointments";
import { useBarberSchedules } from "@/hooks/use-agenda-support";
import { useCrudTable } from "@/hooks/use-crud-table";
import { formatCurrency, formatDuration, formatTime, todayKey, zonedDateKey, zonedDateTime } from "@/lib/datetime";
import { getSupabase } from "@/lib/supabase";
import {
  APPOINTMENT_STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  type Appointment,
  type Barber,
  type BlockedTime,
  type Client,
  type Service,
  type ServicePlan,
  type AppointmentStatus,
} from "@/lib/types";

type View = "day" | "week" | "month";

export default function AgendaPage() {
  const { shop } = useAuth();
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState(todayKey());
  const [barberFilter, setBarberFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [canceling, setCanceling] = useState<Appointment | null>(null);
  const [busyCancel, setBusyCancel] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.search.includes("new=1")) {
      setFormOpen(true);
      window.history.replaceState({}, "", "/agenda");
    }
  }, []);

  const clients = useCrudTable<Client>("clients");
  const services = useCrudTable<Service>("services");
  const plans = useCrudTable<ServicePlan>("service_plans");
  const barbers = useCrudTable<Barber>("barbers");
  const blocks = useCrudTable<BlockedTime>("blocked_times", { orderBy: "starts_at" });
  const schedules = useBarberSchedules(barbers.rows);

  const range = useMemo(() => {
    const parsed = parseISO(anchor);
    if (view === "week") {
      const start = startOfWeek(parsed, { weekStartsOn: 1 });
      return { from: format(start, "yyyy-MM-dd"), to: format(addDays(start, 7), "yyyy-MM-dd") };
    }
    if (view === "month") {
      const start = startOfMonth(parsed);
      const end = endOfMonth(parsed);
      return { from: format(start, "yyyy-MM-dd"), to: format(addDays(end, 1), "yyyy-MM-dd") };
    }
    return { from: anchor, to: format(addDays(parsed, 1), "yyyy-MM-dd") };
  }, [anchor, view]);

  const appointments = useAppointments({
    from: zonedDateTime(range.from, "00:00").toISOString(),
    to: zonedDateTime(range.to, "00:00").toISOString(),
  });

  const filtered = useMemo(() => {
    return appointments.rows.filter((a) => {
      if (barberFilter !== "all" && a.barber_id !== barberFilter) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        a.client?.name.toLowerCase().includes(term) ||
        a.barber?.name.toLowerCase().includes(term) ||
        a.service?.name.toLowerCase().includes(term) ||
        a.plan?.name.toLowerCase().includes(term)
      );
    });
  }, [appointments.rows, barberFilter, search]);

  const move = (direction: number) => {
    const parsed = parseISO(anchor);
    const next = view === "day" ? addDays(parsed, direction)
      : view === "week" ? addDays(parsed, 7 * direction)
      : new Date(parsed.getFullYear(), parsed.getMonth() + direction, 1);
    setAnchor(format(next, "yyyy-MM-dd"));
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const changeStatus = async (appointment: Appointment, status: AppointmentStatus) => {
    setActionError(null);
    const { error } = await getSupabase()
      .from("appointments")
      .update({ status })
      .eq("id", appointment.id);
    if (error) setActionError(error.message);
    else await appointments.reload();
  };

  const confirmCancel = async () => {
    if (!canceling) return;
    setBusyCancel(true);
    await changeStatus(canceling, "canceled");
    setBusyCancel(false);
    setCanceling(null);
  };

  const title = useMemo(() => {
    const parsed = parseISO(anchor);
    if (view === "day") return format(parsed, "'de' d 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (view === "week") return `${format(parseISO(range.from), "d MMM", { locale: ptBR })} — ${format(addDays(parseISO(range.from), 6), "d MMM yyyy", { locale: ptBR })}`;
    return format(parsed, "MMMM 'de' yyyy", { locale: ptBR });
  }, [anchor, view, range.from]);

  const error = appointments.error || actionError;

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Gerencie horários, status e disponibilidade da equipe."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setBlockOpen(true)}><LockKeyhole size={16} /> Bloquear horário</Button>
            <Button variant="primary" onClick={openCreate}><Plus size={16} /> Novo agendamento</Button>
          </div>
        }
      />

      {error && <ErrorState message={error} />}

      <Card className="mb-5 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <IconButton label="Anterior" onClick={() => move(-1)}><ChevronLeft size={18} /></IconButton>
            <Button variant="ghost" onClick={() => setAnchor(todayKey())}>Hoje</Button>
            <IconButton label="Próximo" onClick={() => move(1)}><ChevronRight size={18} /></IconButton>
            <span className="ml-1 text-sm font-semibold capitalize text-slate-200">{title}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="inline-flex rounded-xl border border-white/[0.06] bg-ink-900 p-1">
              {([["day", "Dia", CalendarDays], ["week", "Semana", CalendarRange], ["month", "Mês", ListFilter]] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={clsx(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition sm:flex-none",
                    view === key ? "bg-gold-400/15 text-gold-200" : "text-slate-500 hover:text-slate-200"
                  )}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            <Select value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)} className="sm:w-52">
              <option value="all">Todos os barbeiros</option>
              {barbers.rows.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar na agenda..." />
          </div>
        </div>
      </Card>

      {appointments.loading ? (
        <Card><LoadingState /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum agendamento neste período"
            message="Ajuste os filtros ou crie um novo agendamento para este dia."
            icon={<CalendarDays size={22} />}
          />
        </Card>
      ) : view === "day" ? (
        <DayView appointments={filtered} onEdit={(a) => { setEditing(a); setFormOpen(true); }} onCancel={setCanceling} onStatus={changeStatus} />
      ) : view === "week" ? (
        <WeekView appointments={filtered} range={range} onEdit={(a) => { setEditing(a); setFormOpen(true); }} onCancel={setCanceling} />
      ) : (
        <MonthView appointments={filtered} anchor={anchor} onSelect={(day) => { setAnchor(day); setView("day"); }} />
      )}

      <AppointmentForm
        key={formOpen ? editing?.id ?? "novo" : "fechado"}
        open={formOpen}
        appointment={editing}
        clients={clients.rows}
        services={services.rows}
        plans={plans.rows}
        barbers={barbers.rows}
        schedules={schedules}
        blockedTimes={blocks.rows}
        onClose={() => setFormOpen(false)}
        onSaved={() => { void appointments.reload(); }}
        onClientCreated={() => { void clients.reload(); }}
      />

      <BlockTimeModal
        key={blockOpen ? "aberto" : "fechado"}
        open={blockOpen}
        barbers={barbers.rows}
        shopId={shop?.id}
        onClose={() => setBlockOpen(false)}
        onSaved={() => { void blocks.reload(); }}
      />

      <ConfirmDialog
        open={Boolean(canceling)}
        title="Cancelar agendamento?"
        message={`O agendamento de ${canceling?.client?.name ?? "este cliente"} será marcado como cancelado. O histórico será preservado.`}
        confirmLabel="Cancelar agendamento"
        danger
        loading={busyCancel}
        onConfirm={() => void confirmCancel()}
        onClose={() => setCanceling(null)}
      />
    </div>
  );
}

function AppointmentCard({
  appointment,
  compact,
  onEdit,
  onCancel,
  onStatus,
}: {
  appointment: Appointment;
  compact?: boolean;
  onEdit: (a: Appointment) => void;
  onCancel: (a: Appointment) => void;
  onStatus?: (a: Appointment, status: AppointmentStatus) => void;
}) {
  return (
    <div className={clsx("group rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 transition hover:border-gold-400/25", compact && "p-2.5")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gold-200"><Clock3 size={12} /> {formatTime(appointment.start_at)}</p>
          <p className="mt-1 truncate text-sm font-medium text-slate-100">{appointment.client?.name ?? "Cliente"}</p>
          <p className="truncate text-[11px] text-slate-500">{appointment.service?.name ?? appointment.plan?.name ?? "Atendimento"} · {appointment.barber?.name ?? "—"}</p>
          {!compact && appointment.notes && <p className="mt-1.5 line-clamp-2 text-[11px] italic text-slate-500">“{appointment.notes}”</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Editar" onClick={() => onEdit(appointment)} className="h-7 w-7"><Pencil size={13} /></IconButton>
          <IconButton label="Cancelar agendamento" onClick={() => onCancel(appointment)} className="h-7 w-7 hover:text-rose-300"><Trash2 size={13} /></IconButton>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <StatusBadge label={STATUS_LABEL[appointment.status]} style={STATUS_STYLE[appointment.status]} />
        {!compact && onStatus && (
          <select
            value={appointment.status}
            onChange={(e) => onStatus(appointment, e.target.value as AppointmentStatus)}
            className="rounded-lg border border-white/[0.06] bg-ink-900 px-2 py-1 text-[11px] text-slate-400 outline-none"
            aria-label="Alterar status"
          >
            {APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function DayView({
  appointments,
  onEdit,
  onCancel,
  onStatus,
}: {
  appointments: Appointment[];
  onEdit: (a: Appointment) => void;
  onCancel: (a: Appointment) => void;
  onStatus: (a: Appointment, s: AppointmentStatus) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{appointments.length} agendamentos</p>
        <p className="text-xs text-slate-600">Clique no lápis para editar ou remarcar</p>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {appointments.map((a) => (
          <div key={a.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[80px_1fr_160px] sm:items-center sm:px-5">
            <div>
              <p className="text-lg font-semibold text-white">{formatTime(a.start_at)}</p>
              <p className="text-[11px] text-slate-500">{formatDuration(Math.round((new Date(a.end_at).getTime() - new Date(a.start_at).getTime()) / 60000))}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{a.client?.name ?? "Cliente"}</p>
              <p className="truncate text-xs text-slate-500">
                {a.service?.name ?? a.plan?.name ?? "Atendimento"} · {a.barber?.name ?? "—"}
                {a.plan && <span className="ml-1 text-gold-300/80">({formatCurrency(a.plan.price)})</span>}
              </p>
              {a.notes && <p className="mt-1 text-xs italic text-slate-600">“{a.notes}”</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <StatusBadge label={STATUS_LABEL[a.status]} style={STATUS_STYLE[a.status]} />
              <select
                value={a.status}
                onChange={(e) => onStatus(a, e.target.value as AppointmentStatus)}
                className="rounded-lg border border-white/[0.06] bg-ink-900 px-2 py-1.5 text-[11px] text-slate-400 outline-none"
                aria-label="Alterar status"
              >
                {APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <IconButton label="Editar agendamento" onClick={() => onEdit(a)} className="h-8 w-8"><Pencil size={14} /></IconButton>
              <IconButton label="Cancelar agendamento" onClick={() => onCancel(a)} className="h-8 w-8 hover:text-rose-300"><Trash2 size={14} /></IconButton>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WeekView({
  appointments,
  range,
  onEdit,
  onCancel,
}: {
  appointments: Appointment[];
  range: { from: string; to: string };
  onEdit: (a: Appointment) => void;
  onCancel: (a: Appointment) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(range.from), i), "yyyy-MM-dd"));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day) => {
        const list = appointments.filter((a) => zonedDateKey(a.start_at) === day);
        return (
          <Card key={day} className="min-h-[220px] p-2.5">
            <div className="mb-3 flex items-baseline justify-between px-1">
              <p className="text-xs font-semibold uppercase text-slate-400">{format(parseISO(day), "EEE", { locale: ptBR })}</p>
              <p className="text-sm font-semibold text-white">{format(parseISO(day), "d")}</p>
            </div>
            <div className="space-y-2">
              {list.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-slate-600">Sem agendamentos</p>}
              {list.map((a) => <AppointmentCard key={a.id} appointment={a} compact onEdit={onEdit} onCancel={onCancel} />)}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function MonthView({
  appointments,
  anchor,
  onSelect,
}: {
  appointments: Appointment[];
  anchor: string;
  onSelect: (day: string) => void;
}) {
  const first = startOfMonth(parseISO(anchor));
  const gridStart = startOfWeek(first, { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }, (_, i) => format(addDays(gridStart, i), "yyyy-MM-dd"));
  const today = todayKey();
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/[0.06]">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-600">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const list = appointments.filter((a) => zonedDateKey(a.start_at) === day);
          const outside = parseISO(day).getMonth() !== first.getMonth();
          return (
            <button
              key={day}
              onClick={() => onSelect(day)}
              className={clsx(
                "min-h-[84px] border-b border-r border-white/[0.04] p-2 text-left transition hover:bg-white/[0.04] sm:min-h-[110px]",
                outside && "opacity-35",
                day === today && "bg-gold-400/[0.06]"
              )}
            >
              <span className={clsx("text-xs font-semibold", day === today ? "text-gold-300" : "text-slate-500")}>{format(parseISO(day), "d")}</span>
              <div className="mt-2 space-y-1">
                {list.slice(0, 3).map((a) => (
                  <div key={a.id} className="truncate rounded bg-white/[0.05] px-1.5 py-1 text-[10px] text-slate-300">
                    {formatTime(a.start_at)} {a.client?.name?.split(" ")[0]}
                  </div>
                ))}
                {list.length > 3 && <p className="pl-1 text-[10px] text-gold-300">+{list.length - 3}</p>}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function BlockTimeModal({
  open,
  barbers,
  shopId,
  onClose,
  onSaved,
}: {
  open: boolean;
  barbers: Barber[];
  shopId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [barberId, setBarberId] = useState("all");
  const [date, setDate] = useState(todayKey());
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (start >= end) return setError("O horário final deve ser maior que o inicial.");
    setBusy(true);
    try {
      const { error } = await getSupabase().from("blocked_times").insert({
        barbershop_id: shopId,
        barber_id: barberId === "all" ? null : barberId,
        starts_at: zonedDateTime(date, start).toISOString(),
        ends_at: zonedDateTime(date, end).toISOString(),
        reason: reason.trim() || "Horário bloqueado",
      });
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Erro ao bloquear horário."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Bloquear horário" subtitle="O bloqueio impede novos agendamentos no período.">
      <div className="space-y-4">
        <Field label="Barbeiro">
          <Select value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            <option value="all">Toda a equipe</option>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Das"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Até"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <Field label="Motivo"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Reunião da equipe" /></Field>
        {error && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()} loading={busy}>Bloquear</Button>
        </div>
      </div>
    </Modal>
  );
}
