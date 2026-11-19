"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  UserCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { useAppointments } from "@/hooks/use-appointments";
import { addDaysKey, formatTime, todayKey, zonedDateTime } from "@/lib/datetime";
import { STATUS_LABEL, STATUS_STYLE, type AppointmentStatus } from "@/lib/types";

export default function DashboardPage() {
  const { shop } = useAuth();
  const today = todayKey();
  const dayStart = zonedDateTime(today, "00:00").toISOString();
  const dayEnd = zonedDateTime(addDaysKey(today, 1), "00:00").toISOString();
  const now = new Date().toISOString();
  const weekEnd = zonedDateTime(addDaysKey(today, 7), "23:59").toISOString();

  const todayData = useAppointments({ from: dayStart, to: dayEnd });
  const upcoming = useAppointments({ from: now, to: weekEnd });

  const count = (status: AppointmentStatus) =>
    todayData.rows.filter((a) => a.status === status).length;

  const next = upcoming.rows.filter((a) => a.status !== "canceled" && a.status !== "no_show").slice(0, 6);
  const loading = todayData.loading || upcoming.loading;

  return (
    <div>
      <PageHeader
        title={`Olá, ${shop?.name ?? "barbearia"}`}
        subtitle="Acompanhe o movimento da barbearia em tempo real."
        action={
          <Link href="/agenda?new=1" className="btn-primary">
            <CalendarCheck2 size={16} /> Novo agendamento
          </Link>
        }
      />

      {(todayData.error || upcoming.error) && (
        <ErrorState message={todayData.error || upcoming.error || ""} />
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Agendamentos hoje" value={todayData.rows.length} icon={<ClipboardList size={20} />} tone="gold" />
        <StatCard label="Confirmados" value={count("confirmed")} icon={<CheckCircle2 size={20} />} tone="sky" />
        <StatCard label="Aguardando confirmação" value={count("pending")} icon={<CalendarClock size={20} />} tone="amber" />
        <StatCard label="Cliente chegou" value={count("arrived")} icon={<UserCheck size={20} />} tone="violet" />
        <StatCard label="Em atendimento" value={count("in_progress")} icon={<CircleDot size={20} />} tone="gold" />
        <StatCard label="Concluídos" value={count("completed")} icon={<CalendarCheck2 size={20} />} tone="emerald" />
        <StatCard label="Cancelamentos" value={count("canceled") + count("no_show")} icon={<CalendarX2 size={20} />} tone="rose" />
        <StatCard label="Clientes na agenda" value={new Set(todayData.rows.map((a) => a.client_id)).size} icon={<Users size={20} />} tone="sky" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Próximos atendimentos</h2>
              <p className="text-xs text-slate-500">Os próximos 7 dias</p>
            </div>
            <Link href="/agenda" className="flex items-center gap-1 text-xs font-medium text-gold-300 hover:text-gold-200">
              Ver agenda <ArrowUpRight size={13} />
            </Link>
          </div>
          {loading ? (
            <LoadingState />
          ) : next.length === 0 ? (
            <EmptyState title="Nenhum atendimento próximo" message="Crie um agendamento para começar a organizar sua agenda." />
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {next.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:flex-nowrap">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-sm font-semibold text-gold-200">{formatTime(a.start_at)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{a.client?.name ?? "Cliente"}</p>
                    <p className="truncate text-xs text-slate-500">
                      {a.service?.name ?? a.plan?.name ?? "Atendimento"} · {a.barber?.name ?? "Barbeiro"}
                    </p>
                  </div>
                  <StatusBadge label={STATUS_LABEL[a.status]} style={STATUS_STYLE[a.status]} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold text-white">Resumo do dia</h2>
          <p className="mt-1 text-xs text-slate-500">Distribuição dos agendamentos de hoje</p>
          <div className="mt-5 space-y-3.5">
            {(["pending", "confirmed", "arrived", "in_progress", "completed", "canceled"] as AppointmentStatus[]).map((status) => {
              const value = count(status);
              const pct = todayData.rows.length ? Math.round((value / todayData.rows.length) * 100) : 0;
              return (
                <div key={status}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-slate-400">{STATUS_LABEL[status]}</span>
                    <span className="font-semibold text-slate-200">{value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-7 border-t border-white/[0.06] pt-5">
            <p className="text-[11px] leading-relaxed text-slate-500">
              Valores e preços são apenas informativos. Este painel não registra pagamentos nem movimentações financeiras.
            </p>
            <Link href="/configuracoes" className="mt-3 inline-flex items-center gap-1 text-xs text-gold-300 hover:text-gold-200">
              Ajustar horários <ArrowUpRight size={13} />
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={() => { void todayData.reload(); void upcoming.reload(); }}>
          Atualizar dados
        </Button>
      </div>
    </div>
  );
}
