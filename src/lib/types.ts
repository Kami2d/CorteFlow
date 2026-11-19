export type Json = Record<string, unknown>;

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "arrived"
  | "in_progress"
  | "completed"
  | "canceled"
  | "no_show";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "arrived",
  "in_progress",
  "completed",
  "canceled",
  "no_show",
];

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  arrived: "Cliente chegou",
  in_progress: "Em atendimento",
  completed: "Concluído",
  canceled: "Cancelado",
  no_show: "Não compareceu",
};

export const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  confirmed: "bg-sky-500/10 text-sky-300 border-sky-500/25",
  arrived: "bg-violet-500/10 text-violet-300 border-violet-500/25",
  in_progress: "bg-gold-400/10 text-gold-200 border-gold-400/30",
  completed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  canceled: "bg-rose-500/10 text-rose-300 border-rose-500/25",
  no_show: "bg-slate-500/10 text-slate-300 border-slate-500/25",
};

export interface OpeningHour {
  day: number;
  open: string;
  close: string;
  closed: boolean;
}

export interface BreakInterval {
  start: string;
  end: string;
}

export interface ShopSettings {
  slot_interval: number;
  lead_time_minutes: number;
  cancel_hours: number;
  max_days_ahead: number;
}

export const DEFAULT_SETTINGS: ShopSettings = {
  slot_interval: 30,
  lead_time_minutes: 60,
  cancel_hours: 2,
  max_days_ahead: 60,
};

export interface Barbershop {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  whatsapp: string | null;
  hours: OpeningHour[];
  settings: ShopSettings;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  barbershop_id: string;
  full_name: string | null;
  role: string;
}

export interface Barber {
  id: string;
  barbershop_id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  specialties: string[];
  bio: string | null;
  active: boolean;
  breaks: BreakInterval[];
  created_at: string;
  updated_at: string;
}

export interface BarberSchedule {
  id: string;
  barber_id: string;
  weekday: number;
  start_time: string | null;
  end_time: string | null;
  is_day_off: boolean;
}

export interface Client {
  id: string;
  barbershop_id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServicePlan {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServicePlanItem {
  id: string;
  plan_id: string;
  service_id: string;
  service?: Service;
}

export interface ServiceBarber {
  service_id: string;
  barber_id: string;
}

export interface BlockedTime {
  id: string;
  barbershop_id: string;
  barber_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

export interface Appointment {
  id: string;
  barbershop_id: string;
  client_id: string;
  barber_id: string;
  service_id: string | null;
  plan_id: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  notes: string | null;
  public_token: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  barber?: Barber;
  service?: Service;
  plan?: ServicePlan;
}

export interface AvailabilitySlot {
  startAt: Date;
  endAt: Date;
  barberId: string;
}
