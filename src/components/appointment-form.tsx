"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Plus, Scissors, UserRound } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { useDayBusy } from "@/hooks/use-agenda-support";
import { computeAvailableSlots } from "@/lib/availability";
import { formatCurrency, formatDuration, formatTime, todayKey, zonedDateTime, zonedDateKey } from "@/lib/datetime";
import { getSupabase } from "@/lib/supabase";
import {
  APPOINTMENT_STATUSES,
  STATUS_LABEL,
  type Appointment,
  type Barber,
  type BarberSchedule,
  type BlockedTime,
  type Client,
  type Service,
  type ServicePlan,
} from "@/lib/types";

interface Props {
  open: boolean;
  appointment: Appointment | null;
  clients: Client[];
  services: Service[];
  plans: ServicePlan[];
  barbers: Barber[];
  schedules: BarberSchedule[];
  blockedTimes: BlockedTime[];
  onClose: () => void;
  onSaved: () => void;
  onClientCreated: () => void;
}

export function AppointmentForm({
  open,
  appointment,
  clients,
  services,
  plans,
  barbers,
  schedules,
  blockedTimes,
  onClose,
  onSaved,
  onClientCreated,
}: Props) {
  const { shop } = useAuth();
  const [clientId, setClientId] = useState(appointment?.client_id ?? "");
  const [kind, setKind] = useState<"service" | "plan">(appointment?.plan_id ? "plan" : "service");
  const [serviceId, setServiceId] = useState(appointment?.service_id ?? "");
  const [planId, setPlanId] = useState(appointment?.plan_id ?? "");
  const [barberId, setBarberId] = useState(appointment?.barber_id ?? "all");
  const [dateKey, setDateKey] = useState(
    appointment ? zonedDateKey(appointment.start_at) : todayKey()
  );
  const [startAt, setStartAt] = useState(
    appointment ? new Date(appointment.start_at).toISOString() : ""
  );
  const [status, setStatus] = useState(appointment?.status ?? "pending");
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [newClient, setNewClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [busySaving, setBusySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowedBarberIds, setAllowedBarberIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (kind !== "service" || !serviceId) {
      setAllowedBarberIds(null);
      return;
    }
    let cancelled = false;
    void getSupabase()
      .from("service_barbers")
      .select("barber_id")
      .eq("service_id", serviceId)
      .then(({ data }) => {
        if (!cancelled) setAllowedBarberIds(data?.length ? data.map((r) => r.barber_id as string) : null);
      });
    return () => { cancelled = true; };
  }, [kind, serviceId]);

  const eligibleBarbers = useMemo(
    () => allowedBarberIds ? barbers.filter((b) => allowedBarberIds.includes(b.id)) : barbers,
    [allowedBarberIds, barbers]
  );

  const { intervals } = useDayBusy(dateKey, appointment?.id);

  const service = services.find((s) => s.id === serviceId);
  const plan = plans.find((p) => p.id === planId);
  const duration = kind === "service" ? service?.duration_minutes ?? 0 : plan?.duration_minutes ?? 0;
  const price = kind === "service" ? service?.price ?? 0 : plan?.price ?? 0;

  const slots = useMemo(() => {
    if (!shop || !duration) return [];
    const selected = barberId === "all" ? eligibleBarbers.filter((b) => b.active) : eligibleBarbers.filter((b) => b.id === barberId && b.active);
    return computeAvailableSlots({
      dateKey,
      shopHours: shop.hours,
      settings: shop.settings,
      barbers: selected,
      schedules,
      blockedTimes: blockedTimes.map((b) => ({
        barber_id: b.barber_id,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
      })),
      busy: intervals,
      durationMinutes: duration,
    });
  }, [shop, duration, barberId, eligibleBarbers, dateKey, schedules, blockedTimes, intervals]);

  const save = async () => {
    setError(null);
    if (!clientId) return setError("Selecione ou cadastre um cliente.");
    if (!startAt) return setError("Selecione um horário disponível.");
    if (kind === "service" ? !serviceId : !planId) return setError("Selecione um serviço ou plano.");

    const slot = slots.find((s) => s.startAt.toISOString() === startAt);
    const barber = barberId === "all" ? slot?.barberId : barberId;
    if (!barber) return setError("Selecione um barbeiro.");

    const start = new Date(startAt);
    const payload = {
      client_id: clientId,
      barber_id: barber,
      service_id: kind === "service" ? serviceId : null,
      plan_id: kind === "plan" ? planId : null,
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + duration * 60_000).toISOString(),
      notes: notes.trim() || null,
      status: appointment ? status : "pending",
    };

    setBusySaving(true);
    try {
      const supabase = getSupabase();
      const { error } = appointment
        ? await supabase.from("appointments").update(payload).eq("id", appointment.id)
        : await supabase.from("appointments").insert({ ...payload, barbershop_id: shop?.id });
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar agendamento.");
    } finally {
      setBusySaving(false);
    }
  };

  const createClient = async () => {
    setError(null);
    if (!newName.trim()) return setError("Informe o nome do cliente.");
    setBusySaving(true);
    try {
      const { data, error } = await getSupabase()
        .from("clients")
        .insert({
          barbershop_id: shop?.id,
          name: newName.trim(),
          phone: newPhone.trim() || null,
          whatsapp: newPhone.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      setClientId(data.id as string);
      setNewClient(false);
      setNewName("");
      setNewPhone("");
      onClientCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar cliente.");
    } finally {
      setBusySaving(false);
    }
  };

  const originalStillAvailable =
    appointment &&
    dateKey === zonedDateKey(appointment.start_at) &&
    startAt === appointment.start_at;
  const visibleSlots = originalStillAvailable
    ? [{ startAt: new Date(appointment.start_at), endAt: new Date(appointment.end_at), barberId: appointment.barber_id }, ...slots]
    : slots;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={appointment ? "Editar agendamento" : "Novo agendamento"}
      subtitle={appointment ? "Altere os dados, remarte ou mude o status." : "Preencha os dados para reservar o horário."}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Cliente">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Selecione um cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="flex items-end">
          <Button variant="ghost" onClick={() => setNewClient(!newClient)} className="w-full">
            <Plus size={15} /> {newClient ? "Cancelar cadastro" : "Cadastrar novo cliente"}
          </Button>
        </div>

        {newClient && (
          <div className="sm:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Nome do cliente">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" />
              </Field>
              <Field label="Telefone / WhatsApp">
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </Field>
              <Button onClick={() => void createClient()} loading={busySaving}>Adicionar</Button>
            </div>
          </div>
        )}

        <Field label="Tipo de atendimento">
          <Select value={kind} onChange={(e) => { setKind(e.target.value as "service" | "plan"); setStartAt(""); }}>
            <option value="service">Serviço individual</option>
            <option value="plan">Plano / pacote</option>
          </Select>
        </Field>
        <Field label={kind === "service" ? "Serviço" : "Plano"}>
          <Select
            value={kind === "service" ? serviceId : planId}
            onChange={(e) => { kind === "service" ? setServiceId(e.target.value) : setPlanId(e.target.value); setStartAt(""); }}
          >
            <option value="">Selecione</option>
            {(kind === "service" ? services : plans).filter((i) => i.active).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Barbeiro">
          <Select value={barberId} onChange={(e) => { setBarberId(e.target.value); setStartAt(""); }}>
            <option value="all">Qualquer barbeiro disponível</option>
            {eligibleBarbers.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Data">
          <Input type="date" value={dateKey} onChange={(e) => { setDateKey(e.target.value); setStartAt(""); }} />
        </Field>

        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0 flex items-center gap-2"><Clock3 size={13} /> Horário disponível</span>
            <span className="text-[11px] text-slate-500">
              {barberId === "all" ? "Todos os barbeiros" : eligibleBarbers.find((b) => b.id === barberId)?.name}
            </span>
          </div>
          {!duration ? (
            <p className="rounded-xl border border-white/[0.06] p-4 text-center text-xs text-slate-500">
              Selecione um serviço ou plano para ver os horários.
            </p>
          ) : visibleSlots.length === 0 ? (
            <p className="rounded-xl border border-white/[0.06] p-4 text-center text-xs text-slate-500">
              Nenhum horário disponível nesta data para a duração selecionada.
            </p>
          ) : (
            <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-white/[0.06] bg-ink-900/60 p-2 sm:grid-cols-5">
              {visibleSlots.map((slot) => {
                const key = slot.startAt.toISOString();
                const selected = startAt === key;
                return (
                  <button
                    key={`${slot.barberId}-${key}`}
                    type="button"
                    onClick={() => setStartAt(key)}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      selected
                        ? "border-gold-400 bg-gold-400/15 text-gold-200"
                        : "border-white/[0.06] bg-white/[0.02] text-slate-300 hover:border-gold-400/40"
                    }`}
                  >
                    {formatTime(slot.startAt)}
                    {barberId === "all" && (
                      <span className="block truncate text-[10px] text-slate-500">
                        {eligibleBarbers.find((b) => b.id === slot.barberId)?.name.split(" ")[0]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="sm:col-span-2 grid gap-3 rounded-xl border border-gold-400/15 bg-gold-400/[0.04] p-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Duração</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-white"><CalendarDays size={14} className="text-gold-300" /> {duration ? formatDuration(duration) : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Preço informativo</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-white"><Scissors size={14} className="text-gold-300" /> {duration ? formatCurrency(price) : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Barbeiro</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold text-white"><UserRound size={14} className="text-gold-300" /> {barberId === "all" ? (slots.find((s) => s.startAt.toISOString() === startAt)?.barberId ? eligibleBarbers.find((b) => b.id === slots.find((s) => s.startAt.toISOString() === startAt)?.barberId)?.name : "A definir") : eligibleBarbers.find((b) => b.id === barberId)?.name}</p>
          </div>
        </div>

        {appointment && (
          <div className="sm:col-span-2">
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as Appointment["status"])}>
                {APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </Select>
            </Field>
          </div>
        )}

        <div className="sm:col-span-2">
          <Field label="Observações">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferências do cliente, detalhes do atendimento..." />
          </Field>
        </div>

        {error && <p className="sm:col-span-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()} loading={busySaving}>
            {appointment ? "Salvar alterações" : "Confirmar agendamento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
