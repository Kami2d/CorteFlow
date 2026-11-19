import type {
  Barber,
  BarberSchedule,
  BlockedTime,
  OpeningHour,
  ShopSettings,
} from "@/lib/types";
import {
  TIME_ZONE,
  addDaysKey,
  minutesToTime,
  timeToMinutes,
  todayKey,
  zonedDateTime,
  zonedWeekday,
} from "@/lib/datetime";
import { DEFAULT_SETTINGS } from "@/lib/types";

export interface Interval {
  starts_at: string;
  ends_at: string;
  barber_id: string | null;
}

export interface AvailabilityInput {
  dateKey: string;
  shopHours: OpeningHour[];
  settings: ShopSettings;
  barbers: Barber[];
  schedules: BarberSchedule[];
  blockedTimes: Interval[];
  busy: Interval[];
  durationMinutes: number;
  now?: Date;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/** Verifica sobreposição com bloqueios e agendamentos ativos de um barbeiro. */
export function hasConflict(
  barberId: string,
  startMs: number,
  endMs: number,
  intervals: Interval[]
) {
  return intervals.some(
    (item) =>
      (item.barber_id === null || item.barber_id === barberId) &&
      overlaps(startMs, endMs, new Date(item.starts_at).getTime(), new Date(item.ends_at).getTime())
  );
}

/**
 * Calcula os horários disponíveis respeitando expediente da loja, jornada do
 * barbeiro, intervalos, folgas, bloqueios, agendamentos existentes e lead time.
 * Função pura: usada pela interface e pelos endpoints públicos.
 */
export function computeAvailableSlots(input: AvailabilityInput) {
  const {
    dateKey,
    shopHours,
    settings,
    barbers,
    schedules,
    blockedTimes,
    busy,
    durationMinutes,
    now = new Date(),
  } = input;

  if (!durationMinutes || durationMinutes <= 0) return [];

  const weekday = zonedWeekday(`${dateKey}T12:00:00Z`, TIME_ZONE);
  const shopHour = shopHours.find((h) => h.day === weekday);
  if (!shopHour || shopHour.closed) return [];

  const shopOpen = timeToMinutes(shopHour.open);
  const shopClose = timeToMinutes(shopHour.close);
  const interval = Math.max(15, settings.slot_interval ?? DEFAULT_SETTINGS.slot_interval);
  const lead = Math.max(0, settings.lead_time_minutes ?? DEFAULT_SETTINGS.lead_time_minutes);
  const maxDays = Math.max(1, settings.max_days_ahead ?? DEFAULT_SETTINGS.max_days_ahead);
  const maxDate = addDaysKey(todayKey(), maxDays);
  const minStart = now.getTime() + lead * 60_000;
  if (dateKey > maxDate) return [];

  const slots: { startAt: Date; endAt: Date; barberId: string }[] = [];

  for (const barber of barbers) {
    if (!barber.active) continue;
    const schedule = schedules.find((s) => s.barber_id === barber.id && s.weekday === weekday);
    // Sem registro de escala para o dia: o barbeiro não trabalha nesse dia.
    if (!schedule || schedule.is_day_off || !schedule.start_time || !schedule.end_time) continue;

    const dayStart = Math.max(shopOpen, timeToMinutes(schedule.start_time));
    const dayEnd = Math.min(shopClose, timeToMinutes(schedule.end_time));

    for (let minute = dayStart; minute + durationMinutes <= dayEnd; minute += interval) {
      const start = zonedDateTime(dateKey, minutesToTime(minute), TIME_ZONE);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      if (start.getTime() < minStart) continue;

      const inBreak = barber.breaks.some((br) =>
        overlaps(minute, minute + durationMinutes, timeToMinutes(br.start), timeToMinutes(br.end))
      );
      if (inBreak) continue;
      if (hasConflict(barber.id, start.getTime(), end.getTime(), [...blockedTimes, ...busy])) continue;

      slots.push({ startAt: start, endAt: end, barberId: barber.id });
    }
  }

  return slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

